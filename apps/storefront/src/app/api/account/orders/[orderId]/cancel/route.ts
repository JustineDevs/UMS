import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { fetchCustomerOrders } from "@/lib/medusa-account-orders";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

export const runtime = "nodejs";

const CANCELLABLE_STATUSES = new Set(["pending", "pending_payment", "requires_action"]);

async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const ip = getRequestIp(_req);
  const rl = await rateLimitFixedWindow(`order-cancel:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email?.trim();
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const trimmedId = orderId.trim();

  const { orders } = await fetchCustomerOrders(userEmail);
  const match = orders.find((o) => o.id === trimmedId);
  if (!match) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!CANCELLABLE_STATUSES.has(match.status)) {
    return NextResponse.json(
      { error: `Order cannot be cancelled in status: ${match.status}` },
      { status: 422 },
    );
  }

  try {
    const res = await medusaAdminFetch(`/admin/orders/${trimmedId}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Medusa cancel order failed:", res.status, text);
      return NextResponse.json(
        { error: "Could not cancel order with Medusa" },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cancel order error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 503 });
  }
}

export const POST = withBotIdProtection(handlePOST);
