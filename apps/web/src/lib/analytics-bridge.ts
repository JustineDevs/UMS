import {
  buildAnalyticsChartsPayload,
  type AnalyticsChartsPayload,
} from "@/lib/analytics-chart";
import {
  fetchMedusaOrdersForAdmin,
  type MedusaOrderRow,
} from "@/lib/medusa-order-bridge";

export async function fetchAllMedusaOrdersForAnalytics() {
  const pageSize = 500;
  const all: MedusaOrderRow[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchMedusaOrdersForAdmin(pageSize, offset);
    all.push(...page.orders);
    total = page.total;
    if (page.commerceUnavailable || page.orders.length === 0) break;
    offset += page.orders.length;
  } while (offset < total);

  return all;
}

const completedOrderStatuses = new Set(["paid", "shipped", "delivered"]);

function completedOrders(orders: MedusaOrderRow[]): MedusaOrderRow[] {
  return orders.filter((order) => completedOrderStatuses.has(order.status));
}

export type AnalyticsClv = {
  customer_email: string;
  total_spent: number;
  order_count: number;
  avg_order_value: number;
  first_order_at: string | null;
  last_order_at: string | null;
};

export async function fetchCanonicalCustomerClv(email: string): Promise<AnalyticsClv | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const orders = completedOrders(await fetchAllMedusaOrdersForAnalytics()).filter(
    (order) => order.email?.trim().toLowerCase() === normalized,
  );
  if (orders.length === 0) return null;
  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const total = orders.reduce((sum, order) => sum + order.grand_total, 0);
  return {
    customer_email: normalized,
    total_spent: total,
    order_count: orders.length,
    avg_order_value: total / orders.length,
    first_order_at: sorted[0]?.created_at ?? null,
    last_order_at: sorted[sorted.length - 1]?.created_at ?? null,
  };
}

export type AnalyticsRetention = {
  period: string;
  new_customers: number;
  returning_customers: number;
  retention_rate: number;
};

export async function fetchCanonicalRetention(months = 6): Promise<AnalyticsRetention[]> {
  const safeMonths = Math.min(Math.max(Math.floor(months), 1), 24);
  const orders = completedOrders(await fetchAllMedusaOrdersForAnalytics());
  const results: AnalyticsRetention[] = [];
  const now = new Date();
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const current = new Set(
      orders
        .filter((order) => {
          const created = Date.parse(order.created_at);
          return created >= start.getTime() && created < end.getTime() && order.email;
        })
        .map((order) => order.email!.trim().toLowerCase()),
    );
    const prior = new Set(
      orders
        .filter((order) => Date.parse(order.created_at) < start.getTime() && order.email)
        .map((order) => order.email!.trim().toLowerCase()),
    );
    let returning = 0;
    for (const email of current) if (prior.has(email)) returning += 1;
    results.push({
      period: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      new_customers: current.size - returning,
      returning_customers: returning,
      retention_rate: current.size ? returning / current.size : 0,
    });
  }
  return results;
}

export type AnalyticsSalesTrend = {
  period: string;
  revenue: number;
  order_count: number;
  avg_order_value: number;
};

export async function fetchCanonicalSalesTrends(months = 6): Promise<AnalyticsSalesTrend[]> {
  const safeMonths = Math.min(Math.max(Math.floor(months), 1), 24);
  const orders = completedOrders(await fetchAllMedusaOrdersForAnalytics());
  const now = new Date();
  const results: AnalyticsSalesTrend[] = [];
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const monthOrders = orders.filter((order) => {
      const created = Date.parse(order.created_at);
      return created >= start.getTime() && created < end.getTime();
    });
    const revenue = monthOrders.reduce((sum, order) => sum + order.grand_total, 0);
    results.push({
      period: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      revenue,
      order_count: monthOrders.length,
      avg_order_value: monthOrders.length ? revenue / monthOrders.length : 0,
    });
  }
  return results;
}

export type AnalyticsSummary = {
  orderCount: number;
  revenueTotal: number;
  currency: string;
  paidCount: number;
  pendingCount: number;
};

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const orders = await fetchAllMedusaOrdersForAnalytics();
  const completed = completedOrders(orders);
  let revenueTotal = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const currency = orders[0]?.currency ?? "PHP";

  for (const o of completed) {
    revenueTotal += o.grand_total;
    paidCount += 1;
  }
  for (const o of orders) {
    if (!completedOrderStatuses.has(o.status) && o.status === "pending") pendingCount += 1;
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
  const orders = await fetchAllMedusaOrdersForAnalytics();
  const built = buildAnalyticsChartsPayload(orders, { horizonDays });
  if (!built.ok) {
    console.error("[analytics-bridge] chart payload invalid", built.error.flatten());
    return null;
  }
  return built.data;
}
