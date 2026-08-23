import { NextResponse } from "next/server";
import { findOpenPaymentAttemptForCart } from "@universal-music-store/platform-data";

import { readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const dynamic = "force-dynamic";

/**
 * Safe recovery when sessionStorage lost: returns open attempt for current cart + provider (optional query).
 */
export async function GET(req: Request) {
  const cartId = await readCartIdFromCookie();
  if (!cartId) {
    return NextResponse.json({ error: "No active cart" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const providerParam =
    typeof searchParams.get("provider") === "string"
      ? searchParams.get("provider")!.trim().toLowerCase()
      : "stripe";
  const supportedProviders = ["stripe", "paypal", "xendit"] as const;
  if (!supportedProviders.includes(providerParam as (typeof supportedProviders)[number])) {
    return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
  }
  const provider = providerParam as "stripe" | "paypal" | "xendit";

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Payment ledger is not configured" },
      { status: 503 },
    );
  }

  try {
    const row = await findOpenPaymentAttemptForCart(sb, cartId, provider);
    if (!row) {
      return NextResponse.json({ found: false }, { status: 200 });
    }
    return NextResponse.json({
      found: true,
      correlationId: row.correlation_id,
      status: row.status,
      checkoutState: row.checkout_state,
      medusaOrderId: row.medusa_order_id,
    });
  } catch {
    return NextResponse.json({ error: "Unable to recover payment status" }, { status: 503 });
  }
}
