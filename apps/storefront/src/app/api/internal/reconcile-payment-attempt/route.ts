import { NextResponse } from "next/server";
import {
  getPaymentAttemptByCorrelationId,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";

import { finalizeMedusaCartFromServer } from "@/lib/finalize-medusa-cart-server";
import { internalReconcilePaymentAttemptRouteLogic } from "@/lib/payment-attempt-route-logic";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

/**
 * Server-to-server: staff or worker retries finalization for a ledger row (no browser cookie).
 * Protect with `STOREFRONT_INTERNAL_RECONCILE_SECRET` (same value as admin `STOREFRONT_INTERNAL_RECONCILE_SECRET`).
 */
export async function POST(req: Request) {
  const secret = process.env.STOREFRONT_INTERNAL_RECONCILE_SECRET?.trim();
  const header = req.headers.get("x-internal-secret")?.trim();

  const parsedBody = await parseBoundedJson(req, 8 * 1024);
  if (parsedBody.tooLarge) return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  if (!parsedBody.valid || !parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parsedBody.value as { correlationId?: string };
  const correlationId = typeof body.correlationId === "string" ? body.correlationId.trim() : "";

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
