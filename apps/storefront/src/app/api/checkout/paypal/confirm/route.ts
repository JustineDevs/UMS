import { NextResponse } from "next/server";
import { getPaymentAttemptByCorrelationId } from "@universal-music-store/platform-data";

import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { parseJsonBody, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
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

  const cartCookie = await readCartIdFromCookie();
  const attemptCookie = await readCheckoutAttemptCookie();
  const supabase = createStorefrontServiceSupabase();
  const attempt = supabase ? await getPaymentAttemptByCorrelationId(supabase, correlationId) : null;
  const cartId = cartCookie ?? (attemptCookie === correlationId ? attempt?.cart_id ?? null : null);
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
  if (!base) {
    return NextResponse.json({ error: "PayPal confirmation service is not configured" }, { status: 503 });
  }
  const retrieveResponse = await medusaAdminFetch(`${base.replace(/\/$/, "")}/admin/payment-provider/paypal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation: "payment",
      action: "retrieve",
      order_id: orderId,
      idempotency_key: `paypal-retrieve:${orderId}`,
    }),
  });
  const retrieveBody = (await retrieveResponse.json().catch(() => ({}))) as {
    data?: {
      status?: unknown;
      purchase_units?: Array<{
        amount?: { value?: unknown; currency_code?: unknown };
        payments?: { captures?: Array<{ status?: unknown; amount?: { value?: unknown; currency_code?: unknown } }> };
      }>;
    };
  };
  if (!retrieveResponse.ok) {
    return NextResponse.json({ error: "PayPal payment could not be verified" }, { status: 502 });
  }
  let providerData = retrieveBody.data;
  const retrievedStatus = String(providerData?.status ?? "").toUpperCase();
  if (retrievedStatus === "APPROVED" || retrievedStatus === "PAYER_ACTION_REQUIRED") {
    const captureResponse = await medusaAdminFetch(`${base.replace(/\/$/, "")}/admin/payment-provider/paypal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "payment",
        action: "capture",
        order_id: orderId,
        idempotency_key: `paypal-capture:${orderId}`,
      }),
    });
    const captureBody = (await captureResponse.json().catch(() => ({}))) as { data?: typeof providerData };
    if (!captureResponse.ok || !captureBody.data) {
      return NextResponse.json({ error: "PayPal payment could not be captured" }, { status: 502 });
    }
    providerData = captureBody.data;
  }
  const unit = providerData?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const captureStatus = String(capture?.status ?? providerData?.status ?? "").toUpperCase();
  const captureAmount = Number(capture?.amount?.value ?? unit?.amount?.value);
  const captureCurrency = String(capture?.amount?.currency_code ?? unit?.amount?.currency_code ?? "").toUpperCase();
  const expectedAmount = Number(attempt.amount_minor ?? 0) / 100;
  const expectedCurrency = String(attempt.currency ?? cart.currency_code ?? "").toUpperCase();
  if (
    captureStatus !== "COMPLETED" ||
    !Number.isFinite(captureAmount) ||
    Math.round(captureAmount * 100) !== Math.round(expectedAmount * 100) ||
    !/^[A-Z]{3}$/.test(captureCurrency) ||
    (expectedCurrency && captureCurrency !== expectedCurrency)
  ) {
    return NextResponse.json({ error: "PayPal payment is not a completed match for this checkout" }, { status: 409 });
  }
  const response = await medusaAdminFetch(`${base.replace(/\/$/, "")}/admin/payment-provider/paypal`, {
    method: "POST",
    headers: {
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
