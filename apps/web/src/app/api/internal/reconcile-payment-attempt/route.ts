import { NextResponse } from "next/server";
import {
  getPaymentAttemptByCorrelationId,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";

import { finalizeCheckoutFromServer } from "@/lib/finalize-checkout-server";
import { internalReconcilePaymentAttemptRouteLogic } from "@/lib/payment-attempt-route-logic";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { internalReconcilePaymentAttemptResponseSchema, internalReconcilePaymentAttemptSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

/**
 * Server-to-server: staff or worker retries finalization for a ledger row (no browser cookie).
 * Protect with `STOREFRONT_INTERNAL_RECONCILE_SECRET` (same value as admin `STOREFRONT_INTERNAL_RECONCILE_SECRET`).
 */
export async function POST(req: Request) {
  const secret = process.env.STOREFRONT_INTERNAL_RECONCILE_SECRET?.trim();
  const header = req.headers.get("x-internal-secret")?.trim();

  const parsedBody = await parseBoundedJson(req, 8 * 1024);
  if (parsedBody.tooLarge)
    return NextResponse.json(
      { error: "Request body is too large" },
      { status: 413 },
    );
  if (
    !parsedBody.valid ||
    !parsedBody.value ||
    typeof parsedBody.value !== "object" ||
    Array.isArray(parsedBody.value)
  ) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = internalReconcilePaymentAttemptSchema.safeParse(parsedBody.value);
  if (!parsed.success) return NextResponse.json({ error: "correlationId is required" }, { status: 400 });
  const correlationId = parsed.data.correlationId;

  const sb = createStorefrontServiceSupabase();
  const row =
    sb && correlationId
      ? await getPaymentAttemptByCorrelationId(sb, correlationId)
      : null;
  const result = await internalReconcilePaymentAttemptRouteLogic({
    configuredSecret: secret ?? "",
    providedSecret: header ?? "",
    correlationId,
    row,
    supabaseAvailable: Boolean(sb),
    finalizeCheckout: async (cartId, correlationId) =>
      finalizeCheckoutFromServer(cartId, {
        maxCompleteAttempts: 12,
        correlationId,
      }),
    updatePaymentAttempt: async (id, patch) => {
      if (!sb) {
        return;
      }
      await updatePaymentAttemptByCorrelationId(sb, id, patch).catch(() => {});
    },
    nowIso: () => new Date().toISOString(),
  });

  if (result.status === 200 || (result.body && typeof result.body === "object" && "ok" in result.body)) {
    const validated = internalReconcilePaymentAttemptResponseSchema.safeParse(result.body);
    if (!validated.success) return NextResponse.json({ error: "Payment reconciliation returned an invalid response" }, { status: 502 });
    return NextResponse.json(validated.data, { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
