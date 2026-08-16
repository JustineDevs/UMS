import { NextResponse } from "next/server";
import { getPaymentAttemptByCorrelationId } from "@universal-music-store/platform-data";

import { readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ correlationId: string }> },
) {
  const { correlationId } = await ctx.params;
  if (!correlationId?.trim()) {
    return NextResponse.json({ error: "Missing correlation id" }, { status: 400 });
  }

  const cartId = await readCartIdFromCookie();
  if (!cartId) {
    return NextResponse.json({ error: "No active cart" }, { status: 401 });
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Payment ledger is not configured" },
      { status: 503 },
    );
  }

  const row = await getPaymentAttemptByCorrelationId(sb, correlationId.trim());
  if (!row || row.cart_id !== cartId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    correlationId: row.correlation_id,
    cartId: row.cart_id,
    provider: row.provider,
    providerSessionId: row.provider_session_id,
    providerPaymentId: row.provider_payment_id,
    status: row.status,
    checkoutState: row.checkout_state,
    quoteFingerprint: row.quote_fingerprint,
    staleReason: row.stale_reason,
    medusaOrderId: row.medusa_order_id,
    lastError: row.last_error,
    finalizeAttempts: row.finalize_attempts,
    updatedAt: row.updated_at,
  });
}
