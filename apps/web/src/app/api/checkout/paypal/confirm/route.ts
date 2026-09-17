import { NextResponse } from "next/server";
import { getPaymentAttemptByCorrelationId } from "@universal-music-store/platform-data";

import { parseJsonBody, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readCheckoutAttemptCookie } from "@/lib/checkout-attempt-cookie";

type ConfirmBody = { correlationId?: unknown; orderId?: unknown };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const parsed = await parseJsonBody<ConfirmBody>(req);
  if (!parsed.ok) return parsed.response;
  const correlationId = typeof parsed.data.correlationId === "string" ? parsed.data.correlationId.trim() : "";
  const orderId = typeof parsed.data.orderId === "string" ? parsed.data.orderId.trim() : "";
  if (!correlationId || !orderId) {
    return NextResponse.json({ error: "PayPal confirmation identifiers are required" }, { status: 400 });
  }

  const [cartCookie, attemptCookie] = await Promise.all([
    readCartIdFromCookie(),
    readCheckoutAttemptCookie(),
  ]);
  const supabase = createStorefrontServiceSupabase();
  const attempt = supabase ? await getPaymentAttemptByCorrelationId(supabase, correlationId) : null;
  const cartId = cartCookie ?? (attemptCookie === correlationId ? attempt?.cart_id ?? null : null);
  if (!cartId || !attempt || attempt.cart_id !== cartId || attempt.provider !== "paypal") {
    return NextResponse.json({ error: "PayPal confirmation does not match this checkout" }, { status: 404 });
  }
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!workerBaseUrl) {
    return NextResponse.json({ error: "PayPal confirmation service is not configured" }, { status: 503 });
  }
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || `paypal-confirm:${correlationId}:${orderId}`;
  const response = await fetch(`${workerBaseUrl}/store/checkout/paypal/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...(req.headers.get("Cookie") ? { Cookie: req.headers.get("Cookie") as string } : {}),
    },
    body: JSON.stringify({ correlationId, orderId }),
  });
  const body = await response.json().catch(() => ({ error: "PayPal confirmation failed" }));
  if (!response.ok) {
    return NextResponse.json(body, { status: response.status >= 500 ? 502 : response.status });
  }
  return NextResponse.json({ ok: true, provider: body });
}
