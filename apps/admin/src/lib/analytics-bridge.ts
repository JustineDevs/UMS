import {
  buildAnalyticsChartsPayload,
  type AnalyticsChartsPayload,
} from "@/lib/analytics-chart";
import { fetchMedusaOrdersForAdmin } from "@/lib/medusa-order-bridge";

export type AnalyticsSummary = {
  orderCount: number;
  revenueTotal: number;
  currency: string;
  paidCount: number;
  pendingCount: number;
};

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const { orders } = await fetchMedusaOrdersForAdmin(500, 0);
  let revenueTotal = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const currency = orders[0]?.currency ?? "PHP";

  for (const o of orders) {
    revenueTotal += o.grand_total;
    if (o.status === "paid" || o.status === "shipped" || o.status === "delivered") {
      paidCount += 1;
    } else if (o.status === "pending") {
      pendingCount += 1;
    }
  }

  return {
    orderCount: orders.length,
    revenueTotal,
    currency,
    paidCount,
    pendingCount,
  };
}

export async function fetchValidatedAnalyticsCharts(horizonDays = 30): Promise<
  AnalyticsChartsPayload | null
> {
  const { orders } = await fetchMedusaOrdersForAdmin(500, 0);
  const built = buildAnalyticsChartsPayload(orders, { horizonDays });
  if (!built.ok) {
    console.error("[analytics-bridge] chart payload invalid", built.error.flatten());
    return null;
  }
  return built.data;
}
