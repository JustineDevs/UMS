import { NextResponse } from "next/server";
import { getPaymentPlatformMetrics } from "@universal-music-store/platform-data";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";

type TaskItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  link: string;
  count?: number;
};

export async function GET() {
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;

  const tasks: TaskItem[] = [];
  const sup = adminSupabaseOr503("tasks-today");

  try {
    const medusaUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
    const medusaKey = process.env.MEDUSA_SECRET_API_KEY || "";

    const ordersRes = await fetch(
      `${medusaUrl}/admin/orders?status=pending&limit=100`,
      { headers: { "x-medusa-access-token": medusaKey } },
    );
    if (ordersRes.ok) {
      const ordersJson = (await ordersRes.json()) as { orders?: unknown[]; count?: number };
      const pendingCount = ordersJson.count ?? ordersJson.orders?.length ?? 0;
      if (pendingCount > 0) {
        tasks.push({
          id: "pending-orders",
          type: "overdue_order",
          title: "Pending orders",
          description: `${pendingCount} orders awaiting processing`,
          urgency: pendingCount > 10 ? "high" : "medium",
          link: "/admin/orders?status=pending",
          count: pendingCount,
        });
      }
    }

    const inventoryRes = await fetch(
      `${medusaUrl}/admin/inventory-items?limit=500`,
      { headers: { "x-medusa-access-token": medusaKey } },
    );
    if (inventoryRes.ok) {
      const inventoryJson = (await inventoryRes.json()) as {
        inventory_items?: Array<{
          stocked_quantity?: number;
          reserved_quantity?: number;
        }>;
      };
      const lowStock = (inventoryJson.inventory_items ?? []).filter((item) => {
        const available = (item.stocked_quantity ?? 0) - (item.reserved_quantity ?? 0);
        return available <= 5 && available >= 0;
      });
      if (lowStock.length > 0) {
        tasks.push({
          id: "low-stock",
          type: "low_stock",
          title: "Low stock alerts",
          description: `${lowStock.length} items running low (5 or fewer units)`,
          urgency: lowStock.length > 5 ? "high" : "medium",
          link: "/admin/inventory?filter=low-stock",
          count: lowStock.length,
        });
      }
    }

    const fulfillmentRes = await fetch(
      `${medusaUrl}/admin/orders?fulfillment_status=not_fulfilled&limit=100`,
      { headers: { "x-medusa-access-token": medusaKey } },
    );
    if (fulfillmentRes.ok) {
      const fulfillmentJson = (await fulfillmentRes.json()) as { count?: number; orders?: unknown[] };
      const shipmentsDue = fulfillmentJson.count ?? fulfillmentJson.orders?.length ?? 0;
      if (shipmentsDue > 0) {
        tasks.push({
          id: "shipments-due",
          type: "shipment_due",
          title: "Shipments due",
          description: `${shipmentsDue} orders need to be shipped`,
          urgency: shipmentsDue > 5 ? "high" : "medium",
          link: "/admin/orders?fulfillment=not_fulfilled",
          count: shipmentsDue,
        });
      }
    }
  } catch (err) {
    console.error("[tasks/today] Failed to fetch tasks:", err);
  }

  try {
    if ("client" in sup) {
      const metrics = await getPaymentPlatformMetrics(sup.client);
      if (metrics) {
        if (metrics.paymentAttemptsStaleFinalize > 0) {
          tasks.push({
            id: "stale-payment-attempts",
            type: "pending_review",
            title: "Stale payment sessions",
            description: `${metrics.paymentAttemptsStaleFinalize} checkout attempts need recovery or finalization review`,
            urgency: metrics.paymentAttemptsStaleFinalize > 5 ? "high" : "medium",
            link: "/admin/payments",
            count: metrics.paymentAttemptsStaleFinalize,
          });
        }
        if (metrics.paymentAttemptsNeedsReview > 0) {
          tasks.push({
            id: "payment-needs-review",
            type: "pending_review",
            title: "Payment attempts need review",
            description: `${metrics.paymentAttemptsNeedsReview} payment rows are already marked for operator review`,
            urgency: metrics.paymentAttemptsNeedsReview > 5 ? "high" : "medium",
            link: "/admin/payments",
            count: metrics.paymentAttemptsNeedsReview,
          });
        }
      }
    }
  } catch (err) {
    console.error("[tasks/today] Failed to fetch payment metrics:", err);
  }

  tasks.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return NextResponse.json({ tasks });
}
