import { NextRequest, NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { fetchCustomerOrders } from "@/lib/medusa-account-orders";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { accountMutationFailure } from "@/lib/account-mutation-error";
import {
  buildOrderCancellationIdempotencyKey,
  isCancellableOrderStatus,
} from "@/lib/account-order-mutation";

export const runtime = "nodejs";

async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOriginMutation(_req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(_req);
  const rl = await rateLimitFixedWindow(`order-cancel:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getStorefrontSession();
  const userEmail = session?.user?.email?.trim();
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const trimmedId = orderId.trim();

  const { orders, error: ordersError } = await fetchCustomerOrders(userEmail);
  if (ordersError) {
    const correlationId = crypto.randomUUID();
    console.error("cancel order lookup failed", { correlationId });
    return NextResponse.json(
      accountMutationFailure("Could not load the order right now.", correlationId),
      { status: 503 },
    );
  }
  const match = orders.find((o) => o.id === trimmedId);
  if (!match) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!isCancellableOrderStatus(match.status)) {
    return NextResponse.json(
      { error: "This order can no longer be cancelled." },
      { status: 422 },
    );
  }

  try {
    const idempotencyKey = buildOrderCancellationIdempotencyKey(userEmail, trimmedId);
    const res = await medusaAdminFetch(`/admin/orders/${trimmedId}/cancel`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const correlationId = crypto.randomUUID();
      console.error("Medusa cancel order failed", { correlationId, status: res.status, detailLength: text.length });
      return NextResponse.json(
        accountMutationFailure("Could not cancel the order right now.", correlationId),
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error("cancel order error", { correlationId, error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      accountMutationFailure("Could not cancel the order right now.", correlationId),
      { status: 503 },
    );
  }
}

export const POST = withBotIdProtection(handlePOST);
