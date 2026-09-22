import { getStorefrontSession } from "@/lib/auth";
import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { logCheckoutCompletionEvent } from "@/lib/checkout-telemetry";
import { handleCodPlaceOrderRequest } from "@/lib/cod-place-order-route-handler";
import { finalizeCheckoutFromServer } from "@/lib/finalize-checkout-server";
import { getPublicOriginFromRequest } from "@/lib/finalize-checkout-server";
import { readCheckoutCartTotalsPreview } from "@/lib/checkout-worker";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import { isStorefrontProfileComplete } from "@/lib/storefront-profile-complete";
import { isSameOriginMutation } from "@/lib/request-origin";
import { codPlaceOrderResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";
import {
  claimIsolatedCodAttempt,
  getIsolatedCodAttempt,
  incrementIsolatedCodFinalizeAttempts,
  isIsolatedCodE2E,
  updateIsolatedCodAttempt,
} from "@/lib/isolated-cod-e2e-ledger";

export const dynamic = "force-dynamic";

/**
 * Server-owned COD order placement: browser must not call Medusa `cart.complete` directly.
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return Response.json(
      { error: "Sign in before placing a COD order" },
      { status: 401 },
    );
  }
  if (!isStorefrontProfileComplete(await loadCustomerProfile(email))) {
    return Response.json(
      { error: "Complete your delivery profile before placing a COD order" },
      { status: 400 },
    );
  }

  const isolatedCodE2E = isIsolatedCodE2E();
  const cartId = await readCartIdFromCookie();
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  const response = await handleCodPlaceOrderRequest(req, {
    applyRateLimit: async (request) =>
      applyRateLimit(request, "cod-place-order", 30, 60_000),
    readCartIdFromCookie,
    getPaymentAttemptRow: async (id, requestedCartId) => {
      if (isolatedCodE2E) return getIsolatedCodAttempt(id);
      const activeCartId = requestedCartId ?? cartId;
      if (!workerBaseUrl || !activeCartId) return null;
      try {
        const workerResponse = await fetch(
          `${workerBaseUrl}/store/checkout-intents/${encodeURIComponent(id)}`,
          {
            headers: { Cookie: `mcart_id=${encodeURIComponent(activeCartId)}` },
            cache: "no-store",
          },
        );
        if (!workerResponse.ok) return null;
        const attempt = await readResponseJson<Record<string, unknown>>(
          workerResponse,
          {},
        );
        if (
          typeof attempt.cartId !== "string" ||
          typeof attempt.provider !== "string"
        )
          return null;
        return {
          cart_id: attempt.cartId,
          correlation_id: id,
          provider: attempt.provider,
          status:
            typeof attempt.status === "string" ? attempt.status : undefined,
          quote_fingerprint:
            typeof attempt.quoteFingerprint === "string"
              ? attempt.quoteFingerprint
              : null,
          stale_reason:
            typeof attempt.staleReason === "string"
              ? attempt.staleReason
              : null,
        };
      } catch {
        return null;
      }
    },
    readCurrentQuoteFingerprint: async (activeCartId) => {
      try {
        const preview = await readCheckoutCartTotalsPreview(activeCartId);
        return preview.quoteFingerprint;
      } catch {
        return null;
      }
    },
    incrementFinalizeAttempts: async (id) => {
      if (isolatedCodE2E) {
        incrementIsolatedCodFinalizeAttempts(id);
      }
    },
    claimFinalizeAttempt: async (id) => {
      if (isolatedCodE2E) return claimIsolatedCodAttempt(id);
      // The Worker atomically claims and records finalization; a second claim here
      // would prevent the Worker from seeing its own request as eligible.
      return Boolean(workerBaseUrl);
    },
    updatePaymentAttempt: async (id, patch) => {
      if (isolatedCodE2E) {
        updateIsolatedCodAttempt(id, patch);
      }
    },
    finalizeCheckout: async (activeCartId, correlationId) =>
      finalizeCheckoutFromServer(activeCartId, {
        maxCompleteAttempts: 4,
        publicOrigin: getPublicOriginFromRequest(req),
        correlationId,
      }),
    logEvent: (payload) =>
      logCheckoutCompletionEvent(
        payload as Parameters<typeof logCheckoutCompletionEvent>[0],
      ),
    nowIso: () => new Date().toISOString(),
  });
  if (response.status === 200) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    if (!codPlaceOrderResponseSchema.safeParse(payload).success) {
      return Response.json(
        { error: "Order placement returned an invalid response" },
        { status: 502 },
      );
    }
  }
  return response;
}
