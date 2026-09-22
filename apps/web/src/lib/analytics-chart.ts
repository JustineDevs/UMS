import { z } from "zod";
import type { WorkerAdminOrder } from "@/lib/worker-admin-bridge";

const dailyPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revenue: z.number().finite(),
  orderCount: z.number().int().nonnegative(),
});

const statusSliceSchema = z.object({
  name: z.string().min(1).max(64),
  value: z.number().int().nonnegative(),
});

export const analyticsChartsPayloadSchema = z.object({
  currency: z.string().min(1).max(8),
  daily: z.array(dailyPointSchema).max(400),
  statusBreakdown: z.array(statusSliceSchema).max(32),
});

export type AnalyticsChartsPayload = z.infer<typeof analyticsChartsPayloadSchema>;
function utcDateKey(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date(t).toISOString().slice(0, 10);
}

export function buildAnalyticsChartsPayload(
  orders: WorkerAdminOrder[],
  options?: { horizonDays?: number },
): { ok: true; data: AnalyticsChartsPayload } | { ok: false; error: z.ZodError } {
  const horizonDays = Math.min(Math.max(options?.horizonDays ?? 30, 7), 90);
  const currency = orders[0]?.currency ?? "PHP";

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (horizonDays - 1));
  start.setUTCHours(0, 0, 0, 0);

  const dailyMap = new Map<string, { revenue: number; orderCount: number }>();
  for (let i = 0; i < horizonDays; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { revenue: 0, orderCount: 0 });
  }

  const ordersInWindow: WorkerAdminOrder[] = [];

  for (const o of orders) {
    const key = utcDateKey(o.created_at);
    if (!dailyMap.has(key)) {
      continue;
    }
    ordersInWindow.push(o);
    const row = dailyMap.get(key);
    if (!row) continue;
    row.revenue += Number.isFinite(o.grand_total) ? o.grand_total : 0;
    row.orderCount += 1;
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue * 100) / 100,
      orderCount: v.orderCount,
    }));

  const statusCount = new Map<string, number>();
  for (const o of ordersInWindow) {
    const s = o.status.trim() || "unknown";
    statusCount.set(s, (statusCount.get(s) ?? 0) + 1);
  }
  const statusBreakdown = Array.from(statusCount.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const raw = {
    currency,
    daily,
    statusBreakdown,
  };

  const parsed = analyticsChartsPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, data: parsed.data };
}
