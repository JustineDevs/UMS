import { NextResponse } from "next/server";
import { getPaymentAttemptByCorrelationId } from "@universal-music-store/platform-data";

import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { parseJsonBody, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { isSameOriginMutation } from "@/lib/request-origin";

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

  const cartId = await readCartIdFromCookie();
  const supabase = createStorefrontServiceSupabase();
  const attempt = supabase ? await getPaymentAttemptByCorrelationId(supabase, correlationId) : null;
  if (!cartId || !attempt || attempt.cart_id !== cartId || attempt.provider !== "paypal") {
    return NextResponse.json({ error: "PayPal confirmation does not match this checkout" }, { status: 404 });
  }
  const sdk = createStorefrontMedusaSdk();
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields: "+payment_collection,*payment_collection.payment_sessions",
  } as never);
  const paymentSessions = (
    cart as { payment_collection?: { payment_sessions?: unknown[] } }
  ).payment_collection?.payment_sessions;
  const paymentSession = Array.isArray(paymentSessions)
    ? paymentSessions.find((candidate) => {
        if (!candidate || typeof candidate !== "object") return false;
        const session = candidate as Record<string, unknown>;
        if (session.id !== attempt.provider_session_id) return false;
        const data =
          session.data && typeof session.data === "object"
            ? (session.data as Record<string, unknown>)
            : {};
        return data.paypal_order_id === orderId;
      })
    : undefined;
  if (!paymentSession) {
    return NextResponse.json({ error: "PayPal order does not match this checkout" }, { status: 409 });
  }

  const base = (process.env.MEDUSA_ADMIN_API_URL ?? process.env.MEDUSA_BACKEND_URL ?? process.env.MEDUSA_URL)?.trim();
  const internalToken = (
    process.env.MEDUSA_INTERNAL_ADMIN_TOKEN || process.env.MEDUSA_SECRET_API_KEY
  )?.trim();
  if (!base || !internalToken) {
    return NextResponse.json({ error: "PayPal confirmation service is not configured" }, { status: 503 });
  }
  const response = await medusaAdminFetch(`${base.replace(/\/$/, "")}/admin/payment-provider/paypal`, {
    method: "POST",
    headers: {
      "x-uvs-internal-token": internalToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation: "payment",
      action: "confirm",
      session_id: attempt.provider_session_id,
      amount: attempt.amount_minor,
      idempotency_key: `paypal-confirm:${orderId}`,
    }),
  });
  const body = await response.json().catch(() => ({ error: "PayPal confirmation failed" }));
  if (!response.ok) return NextResponse.json({ error: "PayPal confirmation failed" }, { status: response.status >= 500 ? 502 : response.status });
  return NextResponse.json({ ok: true, provider: body });
}
