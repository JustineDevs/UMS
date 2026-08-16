import {
  getPaymentAttemptByCorrelationId,
  incrementFinalizeAttempts,
  claimPaymentAttemptForFinalization,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";

import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { logCheckoutCompletionEvent } from "@/lib/checkout-telemetry";
import { handleFinalizeCheckoutIntentRequest } from "@/lib/finalize-checkout-intent-route-handler";
import { finalizeMedusaCartFromServer } from "@/lib/finalize-medusa-cart-server";
import { readMedusaCartTotalsPreview } from "@/lib/medusa-checkout-cart-prep";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { capturePostHogEvent } from "@universal-music-store/sdk";

export const dynamic = "force-dynamic";

/**
 * Server-owned order finalization after hosted payment. Browser should call this instead of
 * owning the retry loop; the return page polls GET checkout-intents until completed.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ correlationId: string }> },
) {
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

  return response;
}
