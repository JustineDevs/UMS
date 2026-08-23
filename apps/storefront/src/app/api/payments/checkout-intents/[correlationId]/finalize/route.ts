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
import { finalizeMedusaCartFromServer } from "@/lib/finalize-medusa-cart-server";
import { readMedusaCartTotalsPreview } from "@/lib/medusa-checkout-cart-prep";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import { capturePostHogEvent } from "@universal-music-store/sdk";
import { isAuthorizedMedusaPaymentSession } from "@/lib/payment-session-verification";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isPaidStripeCheckoutSession } from "@/lib/stripe-checkout-verification";

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
): Promise<boolean> {
  const sessionId = row.provider_session_id?.trim();
  if (row.provider === "stripe" && row.provider_payment_id) {
    return isPaidStripeCheckoutSession({
      sessionId: row.provider_payment_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      apiKey: process.env.STRIPE_API_KEY,
    });
  }
  if (!sessionId) return false;
  const sdk = createStorefrontMedusaSdk();
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields: "+payment_collection,*payment_collection.payment_sessions",
  } as never);
  const sessions = (cart as { payment_collection?: { payment_sessions?: unknown[] } })
    .payment_collection?.payment_sessions;
  if (!Array.isArray(sessions)) return false;
  const session = sessions.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const record = candidate as Record<string, unknown>;
    return record.id === sessionId ||
      (typeof record.provider_id === "string" &&
        record.provider_id.toLowerCase().includes(row.provider.toLowerCase()));
  });
  return isAuthorizedMedusaPaymentSession(session, row);
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
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const { correlationId } = await ctx.params;
  const sb = createStorefrontServiceSupabase();
  const response = await handleFinalizeCheckoutIntentRequest(req, correlationId ?? "", {
    applyRateLimit: async (request) =>
      applyRateLimit(request, "checkout-intents-finalize", 40, 60_000),
    readCartIdFromCookie,
    getPaymentAttemptRow: async (id) =>
      sb ? getPaymentAttemptByCorrelationId(sb, id) : null,
    readCurrentQuoteFingerprint: async (activeCartId) => {
      try {
        const preview = await readMedusaCartTotalsPreview(activeCartId);
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
      verifyMedusaPaymentSession(row!, activeCartId),
    updatePaymentAttempt: async (id, patch) => {
      if (!sb) {
        return;
      }
      await updatePaymentAttemptByCorrelationId(sb, id, patch);
    },
    finalizeMedusaCart: async (activeCartId, publicOrigin) =>
      finalizeMedusaCartFromServer(activeCartId, {
        maxCompleteAttempts: 2,
        publicOrigin,
      }),
    logEvent: (payload) =>
      logCheckoutCompletionEvent(payload as Parameters<typeof logCheckoutCompletionEvent>[0]),
    nowIso: () => new Date().toISOString(),
  });

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
    const body = (await response.clone().json().catch(() => null)) as { orderId?: unknown } | null;
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
