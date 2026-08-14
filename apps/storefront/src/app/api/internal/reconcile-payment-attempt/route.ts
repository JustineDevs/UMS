import { NextResponse } from "next/server";
import {
  getPaymentAttemptByCorrelationId,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";

import { finalizeMedusaCartFromServer } from "@/lib/finalize-medusa-cart-server";
import { internalReconcilePaymentAttemptRouteLogic } from "@/lib/payment-attempt-route-logic";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const dynamic = "force-dynamic";

/**
 * Server-to-server: staff or worker retries finalization for a ledger row (no browser cookie).
 * Protect with `STOREFRONT_INTERNAL_RECONCILE_SECRET` (same value as admin `STOREFRONT_INTERNAL_RECONCILE_SECRET`).
 */
export async function POST(req: Request) {
  const secret = process.env.STOREFRONT_INTERNAL_RECONCILE_SECRET?.trim();
  const header = req.headers.get("x-internal-secret")?.trim();

  let correlationId = "";
  try {
    const body = (await req.json()) as { correlationId?: string };
    if (typeof body.correlationId === "string" && body.correlationId.trim()) {
      correlationId = body.correlationId.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sb = createStorefrontServiceSupabase();
  const row = sb && correlationId ? await getPaymentAttemptByCorrelationId(sb, correlationId) : null;
  const result = await internalReconcilePaymentAttemptRouteLogic({
    configuredSecret: secret ?? "",
    providedSecret: header ?? "",
    correlationId,
    row,
    supabaseAvailable: Boolean(sb),
    finalizeMedusaCart: async (cartId) =>
      finalizeMedusaCartFromServer(cartId, { maxCompleteAttempts: 12 }),
    updatePaymentAttempt: async (id, patch) => {
      if (!sb) {
        return;
      }
      await updatePaymentAttemptByCorrelationId(sb, id, patch).catch(() => {});
    },
    nowIso: () => new Date().toISOString(),
  });

  return NextResponse.json(result.body, { status: result.status });
}
