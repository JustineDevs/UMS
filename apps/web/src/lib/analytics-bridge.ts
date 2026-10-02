import {
  buildAnalyticsChartsPayload,
  type AnalyticsChartsPayload,
} from "@/lib/analytics-chart";
import { fetchWorkerOrdersForAdmin, type WorkerAdminOrder } from "@/lib/worker-admin-bridge";

export const MAX_ANALYTICS_ORDERS = 10_000;

export class AnalyticsDataLimitError extends Error {
  readonly code = "ANALYTICS_DATA_LIMIT";

  constructor() {
    super(`Analytics order volume exceeds the ${MAX_ANALYTICS_ORDERS.toLocaleString()}-row safety limit`);
    this.name = "AnalyticsDataLimitError";
  }
}

export function assertAnalyticsOrderBudget(total: number, collected: number): void {
  if (total > MAX_ANALYTICS_ORDERS || collected > MAX_ANALYTICS_ORDERS) {
    throw new AnalyticsDataLimitError();
  }
}

export async function fetchAllWorkerOrdersForAnalytics(): Promise<WorkerAdminOrder[]> {
  const pageSize = 100;
  const all: WorkerAdminOrder[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchWorkerOrdersForAdmin(pageSize, offset);
    assertAnalyticsOrderBudget(page.total, all.length);
    all.push(...page.orders);
    assertAnalyticsOrderBudget(page.total, all.length);
    total = page.total;
    if (page.commerceUnavailable || page.orders.length === 0) break;
    offset += page.orders.length;
  } while (offset < total);

  return all;
}

const completedOrderStatuses = new Set(["paid", "shipped", "delivered"]);

function completedOrders(orders: WorkerAdminOrder[]): WorkerAdminOrder[] {
  return orders.filter((order) => completedOrderStatuses.has(order.status));
}

export type AnalyticsSummary = {
  orderCount: number;
  revenueTotal: number;
  currency: string;
  paidCount: number;
  pendingCount: number;
};

export async function fetchAnalyticsSummary(orders?: WorkerAdminOrder[]): Promise<AnalyticsSummary> {
  const source = orders ?? await fetchAllWorkerOrdersForAnalytics();
  const completed = completedOrders(source);
  let revenueTotal = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const currency = source[0]?.currency ?? "PHP";

  for (const o of completed) {
    revenueTotal += o.grand_total;
    paidCount += 1;
  }
  for (const o of source) {
    if (!completedOrderStatuses.has(o.status) && o.status === "pending") pendingCount += 1;
  }

  return {
    orderCount: source.length,
    revenueTotal,
    currency,
    paidCount,
    pendingCount,
  };
}

export async function fetchValidatedAnalyticsCharts(horizonDays = 30, orders?: WorkerAdminOrder[]): Promise<
  AnalyticsChartsPayload | null
> {
  const source = orders ?? await fetchAllWorkerOrdersForAnalytics();
  const built = buildAnalyticsChartsPayload(source, { horizonDays });
  if (!built.ok) {
    console.error("[analytics-bridge] chart payload invalid", built.error.flatten());
    return null;
  }
  return built.data;
}
