import { NextResponse } from "next/server";
import {
  claimPaymentAttemptForFinalization,
  listStuckPaymentAttempts,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";

import { finalizeMedusaCartFromServer } from "@/lib/finalize-medusa-cart-server";
import { finalizePaymentAttemptsCronRouteLogic } from "@/lib/payment-attempt-route-logic";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const dynamic = "force-dynamic";

/**
 * Server-side recovery for payment attempts stuck after hosted pay (webhook lag, closed tab).
 * Schedule: external scheduler GET with secret. The deployed fallback is GitHub Actions;
 * webhooks remain the primary payment-completion path.
 * Auth: `Authorization: Bearer <secret>` or `x-cron-secret`. Secret is `CRON_SECRET`,
 * with `STOREFRONT_PAYMENT_CRON_SECRET` supported for local parity.
 */
export async function GET(req: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.STOREFRONT_PAYMENT_CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-cron-secret")?.trim();

  const sb = createStorefrontServiceSupabase();
  try {
    const stuck = sb ? await listStuckPaymentAttempts(sb, 25) : [];
    const result = await finalizePaymentAttemptsCronRouteLogic({
      configuredSecret: secret ?? "",
      providedSecret: token ?? "",
      supabaseAvailable: Boolean(sb),
      stuckRows: stuck,
      claimFinalizeAttempt: async (id) => {
        if (!sb) return false;
        return claimPaymentAttemptForFinalization(sb, id);
      },
      finalizeMedusaCart: async (cartId, correlationId) =>
        finalizeMedusaCartFromServer(cartId, { maxCompleteAttempts: 12, correlationId }),
      updatePaymentAttempt: async (id, patch) => {
        if (!sb) {
          return;
        }
        await updatePaymentAttemptByCorrelationId(sb, id, patch).catch(() => {});
      },
      nowIso: () => new Date().toISOString(),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[finalize-payment-attempts] reconciliation failed", error);
    return NextResponse.json({ error: "Payment recovery is temporarily unavailable" }, { status: 503 });
  }
}
