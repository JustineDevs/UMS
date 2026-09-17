import {
  getPaymentAttemptByCorrelationId,
  incrementFinalizeAttempts,
  claimPaymentAttemptForFinalization,
  updatePaymentAttemptByCorrelationId,
  linkCommerceAttributionOrder,
} from "@universal-music-store/platform-data";

import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { logCheckoutCompletionEvent } from "@/lib/checkout-telemetry";
import { handleFinalizeCheckoutIntentRequest } from "@/lib/finalize-checkout-intent-route-handler";
import { finalizeCheckoutFromServer } from "@/lib/finalize-checkout-server";
import {
  getPublicOriginFromRequest,
  secureTrackingRedirectUrl,
} from "@/lib/finalize-checkout-server";
import { readCheckoutCartTotalsPreview } from "@/lib/checkout-worker";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { capturePostHogEvent } from "@universal-music-store/sdk";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isPaidStripeCheckoutSession } from "@/lib/stripe-checkout-verification";
import { readCheckoutAttemptCookie } from "@/lib/checkout-attempt-cookie";

export const dynamic = "force-dynamic";

async function verifyMedusaPaymentSession(
  row: {
    provider_session_id?: string | null;
    provider_payment_id?: string | null;
    provider: string;
    amount_minor?: number | null;
    currency?: string | null;
  },
  cartId: string,
  request: Request,
  correlationId: string,
): Promise<boolean> {
  if (row.provider === "stripe" && row.provider_payment_id) {
    return isPaidStripeCheckoutSession({
      sessionId: row.provider_payment_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      apiKey: process.env.STRIPE_API_KEY,
    });
  }
  if (!correlationId.trim()) return false;
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return false;
  const response = await fetch(
    `${apiUrl}/store/checkout-intents/${encodeURIComponent(correlationId)}`,
    {
      cache: "no-store",
      headers: {
        ...(request.headers.get("cookie")
          ? { Cookie: request.headers.get("cookie")! }
          : {}),
      },
    },
  );
  if (!response.ok) return false;
  const payload = (await response.json().catch(() => ({}))) as {
    provider?: unknown;
    status?: unknown;
  };
  return (
    payload.provider === row.provider &&
    typeof payload.status === "string" &&
    new Set(["authorized", "captured", "completed", "paid", "succeeded"]).has(
      payload.status.toLowerCase(),
    )
  );
}

/**
 * Server-owned order finalization after hosted payment. Browser should call this instead of
 * owning the retry loop; the return page polls GET checkout-intents until completed.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ correlationId: string }> },
) {
  if (!isSameOriginMutation(req)) {
    return Response.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const { correlationId } = await ctx.params;
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (workerBaseUrl) {
    const response = await fetch(
      `${workerBaseUrl}/store/checkout-intents/${encodeURIComponent(correlationId ?? "")}/finalize`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(req.headers.get("cookie")
            ? { Cookie: req.headers.get("cookie")! }
            : {}),
        },
        cache: "no-store",
      },
    );
    const payload = await response
      .json()
      .catch(() => ({ error: "Order finalization failed" }));
    if (response.ok && typeof payload?.orderId === "string") {
      const redirectUrl = secureTrackingRedirectUrl(
        typeof payload?.redirectUrl === "string"
          ? payload.redirectUrl
          : undefined,
        payload.orderId,
        getPublicOriginFromRequest(req),
      );
      if (!redirectUrl) {
        return Response.json(
          { error: "Tracking capability is not configured" },
          { status: 503 },
        );
      }
      return Response.json(
        { ...payload, redirectUrl },
        { status: response.status },
      );
    }
    return Response.json(payload, { status: response.status });
  }
  const sb = createStorefrontServiceSupabase();
  const response = await handleFinalizeCheckoutIntentRequest(
    req,
    correlationId ?? "",
    {
      applyRateLimit: async (request) =>
        applyRateLimit(request, "checkout-intents-finalize", 40, 60_000),
      readCartIdFromCookie,
      readCheckoutCorrelationCookie: readCheckoutAttemptCookie,
      getPaymentAttemptRow: async (id) =>
        sb ? getPaymentAttemptByCorrelationId(sb, id) : null,
      readCurrentQuoteFingerprint: async (activeCartId) => {
        try {
          const preview = await readCheckoutCartTotalsPreview(activeCartId);
          return preview.quoteFingerprint;
        } catch {
          return null;
        }
      },
      incrementFinalizeAttempts: async (id) => {
        if (!sb) {
          throw new Error("Payment ledger is not configured");
        }
        return incrementFinalizeAttempts(sb, id);
      },
      claimFinalizeAttempt: async (id) => {
        if (!sb) throw new Error("Payment ledger is not configured");
        return claimPaymentAttemptForFinalization(sb, id);
      },
      verifyProviderPayment: async (row, activeCartId) =>
        verifyMedusaPaymentSession(row!, activeCartId, req, correlationId),
      updatePaymentAttempt: async (id, patch) => {
        if (!sb) {
          return;
        }
        await updatePaymentAttemptByCorrelationId(sb, id, patch);
      },
      finalizeCheckout: async (activeCartId, correlationId) =>
        finalizeCheckoutFromServer(activeCartId, {
          maxCompleteAttempts: 2,
          publicOrigin: getPublicOriginFromRequest(req),
          correlationId,
        }),
      logEvent: (payload) =>
        logCheckoutCompletionEvent(
          payload as Parameters<typeof logCheckoutCompletionEvent>[0],
        ),
      nowIso: () => new Date().toISOString(),
    },
  );

  void capturePostHogEvent({
    event:
      response.status === 200
        ? "checkout_finalize_succeeded"
        : "checkout_finalize_failed",
    distinctId: correlationId || "unknown",
    properties: {
      status: response.status,
      correlationId: correlationId || null,
    },
  });

  if (sb && response.status === 200) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { orderId?: unknown } | null;
    const row = await getPaymentAttemptByCorrelationId(sb, correlationId);
    if (row && typeof body?.orderId === "string") {
      await linkCommerceAttributionOrder(sb, {
        cartId: row.cart_id,
        orderId: body.orderId,
        organizationId: process.env.DEFAULT_ORGANIZATION_ID?.trim() || null,
      }).catch(() => {});
    }
  }
  return response;
}
