import { NextResponse } from "next/server";
import { findOpenPaymentAttemptForCart } from "@universal-music-store/platform-data";

import { readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { readCheckoutAttemptCookie } from "@/lib/checkout-attempt-cookie";
import { matchesProviderOrderId } from "@/lib/payment-intent-recovery";

export const dynamic = "force-dynamic";

/**
 * Safe recovery when sessionStorage lost: returns open attempt for current cart + provider (optional query).
 */
export async function GET(req: Request) {
  const cartId = await readCartIdFromCookie();
  const attemptCookie = await readCheckoutAttemptCookie();

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
  const providerOrderId = searchParams.get("provider_order_id")?.trim() ?? "";

  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (workerBaseUrl && attemptCookie) {
    const response = await fetch(
      `${workerBaseUrl}/store/checkout-intents/${encodeURIComponent(attemptCookie)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(req.headers.get("cookie") ? { Cookie: req.headers.get("cookie")! } : {}),
        },
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const body = payload as { provider?: unknown; correlationId?: unknown };
      if (body.provider !== provider) return NextResponse.json({ found: false });
      return NextResponse.json({
        found: true,
        correlationId: body.correlationId,
        status: (payload as { status?: unknown }).status,
        checkoutState: (payload as { checkoutState?: unknown }).checkoutState,
        medusaOrderId: (payload as { medusaOrderId?: unknown }).medusaOrderId,
      });
    }
    if (response.status !== 404) {
      return NextResponse.json({ error: "Unable to recover payment status" }, { status: 503 });
    }
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Payment ledger is not configured" },
      { status: 503 },
    );
  }

  try {
    let row: Awaited<ReturnType<typeof findOpenPaymentAttemptForCart>>;
    if (providerOrderId && cartId) {
      const result = await sb
        .from("payment_attempts")
        .select("*")
        .eq("cart_id", cartId)
        .eq("provider", provider)
        .eq("provider_payment_id", providerOrderId)
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      row = result.data as Awaited<ReturnType<typeof findOpenPaymentAttemptForCart>>;
      if (
        row &&
        providerOrderId &&
        !matchesProviderOrderId(row, providerOrderId)
      ) {
        row = null;
      }
    } else if (cartId) {
      row = await findOpenPaymentAttemptForCart(sb, cartId, provider);
    } else if (attemptCookie) {
      const result = await sb
        .from("payment_attempts")
        .select("*")
        .eq("correlation_id", attemptCookie)
        .eq("provider", provider)
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      row = result.data as Awaited<ReturnType<typeof findOpenPaymentAttemptForCart>>;
    } else {
      return NextResponse.json({ error: "No active checkout" }, { status: 401 });
    }
    if (!row) {
      return NextResponse.json({ found: false }, { status: 200 });
    }
    if (cartId && row.cart_id !== cartId) {
      return NextResponse.json({ error: "Checkout does not belong to this cart" }, { status: 404 });
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
