import {
  getPaymentAttemptByCorrelationId,
  incrementFinalizeAttempts,
  claimPaymentAttemptForFinalization,
  updatePaymentAttemptByCorrelationId,
  linkCommerceAttributionOrder,
} from "@universal-music-store/platform-data";

import { getStorefrontSession } from "@/lib/auth";
import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { logCheckoutCompletionEvent } from "@/lib/checkout-telemetry";
import { handleCodPlaceOrderRequest } from "@/lib/cod-place-order-route-handler";
import { finalizeMedusaCartFromServer } from "@/lib/finalize-medusa-cart-server";
import { getPublicOriginFromRequest } from "@/lib/finalize-medusa-cart-server";
import { readMedusaCartTotalsPreview } from "@/lib/medusa-checkout-cart-prep";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import { isStorefrontProfileComplete } from "@/lib/storefront-profile-complete";
import { isSameOriginMutation } from "@/lib/request-origin";
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
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Sign in before placing a COD order" }, { status: 401 });
  }
  if (!isStorefrontProfileComplete(await loadCustomerProfile(email))) {
    return Response.json(
      { error: "Complete your delivery profile before placing a COD order" },
      { status: 400 },
    );
  }

  const sb = createStorefrontServiceSupabase();
  const isolatedCodE2E = isIsolatedCodE2E();
  const response = await handleCodPlaceOrderRequest(req, {
    applyRateLimit: async (request) =>
      applyRateLimit(request, "cod-place-order", 30, 60_000),
    readCartIdFromCookie,
    getPaymentAttemptRow: async (id) => {
      if (sb) return getPaymentAttemptByCorrelationId(sb, id);
      return isolatedCodE2E ? getIsolatedCodAttempt(id) : null;
    },
    readCurrentQuoteFingerprint: async (activeCartId) => {
      try {
        const preview = await readMedusaCartTotalsPreview(activeCartId);
        return preview.quoteFingerprint;
      } catch {
        return null;
      }
    },
    incrementFinalizeAttempts: async (id) => {
      if (isolatedCodE2E && !sb) {
        incrementIsolatedCodFinalizeAttempts(id);
        return;
      }
      if (!sb) {
        throw new Error("Payment ledger is not configured");
      }
      await incrementFinalizeAttempts(sb, id);
    },
    claimFinalizeAttempt: async (id) => {
      if (isolatedCodE2E && !sb) return claimIsolatedCodAttempt(id);
      if (!sb) throw new Error("Payment ledger is not configured");
      return claimPaymentAttemptForFinalization(sb, id);
    },
    updatePaymentAttempt: async (id, patch) => {
      if (isolatedCodE2E && !sb) {
        updateIsolatedCodAttempt(id, patch);
        return;
      }
      if (!sb) {
        return;
      }
      await updatePaymentAttemptByCorrelationId(sb, id, patch).catch(() => {});
    },
    finalizeMedusaCart: async (activeCartId, correlationId) =>
      finalizeMedusaCartFromServer(activeCartId, {
        maxCompleteAttempts: 4,
        publicOrigin: getPublicOriginFromRequest(req),
        correlationId,
      }),
    logEvent: (payload) =>
      logCheckoutCompletionEvent(payload as Parameters<typeof logCheckoutCompletionEvent>[0]),
    nowIso: () => new Date().toISOString(),
  });
  if (sb && response.status === 200) {
    const body = (await response.clone().json().catch(() => null)) as { orderId?: unknown } | null;
    const cartId = await readCartIdFromCookie();
    if (cartId && typeof body?.orderId === "string") {
      await linkCommerceAttributionOrder(sb, {
        cartId,
        orderId: body.orderId,
        organizationId: process.env.DEFAULT_ORGANIZATION_ID?.trim() || null,
      }).catch(() => {});
    }
  }
  return response;
}
