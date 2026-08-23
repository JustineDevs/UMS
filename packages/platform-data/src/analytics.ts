import type { SupabaseClient } from "@supabase/supabase-js";

export type ClvResult = {
  customer_email: string;
  total_spent: number;
  order_count: number;
  avg_order_value: number;
  first_order_at: string | null;
  last_order_at: string | null;
};

export type RetentionMetric = {
  period: string;
  new_customers: number;
  returning_customers: number;
  retention_rate: number;
};

export type SalesTrend = {
  period: string;
  revenue: number;
  order_count: number;
  avg_order_value: number;
};

export type TopProduct = {
  product_id: string;
  product_title: string;
  units_sold: number;
  revenue: number;
};

/** Analytics buckets are UTC; timezone conversion belongs at presentation boundaries. */
export function utcMonthWindow(now: Date, monthsAgo: number): {
  start: Date;
  end: Date;
  period: string;
} {
  if (!Number.isInteger(monthsAgo) || monthsAgo < 0) {
    throw new Error("monthsAgo must be a non-negative integer");
  }
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1),
  );
  return {
    start,
    end,
    period: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

/**
 * Compute CLV for a customer based on loyalty_transactions data.
 * In production this would join Medusa order data. Here we use
 * loyalty points as a proxy for spend tracking.
 */
export async function computeClv(
  supabase: SupabaseClient,
  customerEmail: string,
): Promise<ClvResult | null> {
  const { data: account } = await supabase
    .from("loyalty_accounts")
    .select("id, lifetime_points, created_at")
    .eq("customer_email", customerEmail)
    .maybeSingle();
  if (!account) return null;

  const { data: txns } = await supabase
    .from("loyalty_transactions")
    .select("points_delta, order_id, created_at")
    .eq("loyalty_account_id", account.id)
    .order("created_at");

  const earnTxns = (txns ?? []).filter(
    (t) => Number(t.points_delta) > 0 && t.order_id,
  );
  const totalPoints = earnTxns.reduce(
    (sum, t) => sum + Number(t.points_delta),
    0,
  );
  const orderCount = earnTxns.length;
  const estimatedSpend = totalPoints * 100;

  return {
    customer_email: customerEmail,
    total_spent: estimatedSpend,
    order_count: orderCount,
    avg_order_value: orderCount > 0 ? estimatedSpend / orderCount : 0,
    first_order_at: earnTxns.length > 0 ? String(earnTxns[0].created_at) : null,
    last_order_at:
      earnTxns.length > 0
        ? String(earnTxns[earnTxns.length - 1].created_at)
        : null,
  };
}

/**
 * Compute monthly retention from loyalty_transactions.
 */
export async function computeRetention(
  supabase: SupabaseClient,
  months: number = 6,
): Promise<RetentionMetric[]> {
  const results: RetentionMetric[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const { start, end, period } = utcMonthWindow(now, i);

    const { data: currentMonth } = await supabase
      .from("loyalty_transactions")
      .select("loyalty_account_id")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .gt("points_delta", 0);

    const currentIds = new Set(
      (currentMonth ?? []).map((r) => String(r.loyalty_account_id)),
    );

    const { data: priorAll } = await supabase
      .from("loyalty_transactions")
      .select("loyalty_account_id")
      .lt("created_at", start.toISOString())
      .gt("points_delta", 0);

    const priorIds = new Set(
      (priorAll ?? []).map((r) => String(r.loyalty_account_id)),
    );

    let returning = 0;
    let newCust = 0;
    for (const id of currentIds) {
      if (priorIds.has(id)) returning++;
      else newCust++;
    }

    results.push({
      period,
      new_customers: newCust,
      returning_customers: returning,
      retention_rate:
        currentIds.size > 0 ? returning / currentIds.size : 0,
    });
  }

  return results;
}

/**
 * Aggregate sales trend per month from POS shift data.
 */
export async function computeSalesTrends(
  supabase: SupabaseClient,
  months: number = 6,
): Promise<SalesTrend[]> {
  const results: SalesTrend[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const { start, end, period } = utcMonthWindow(now, i);

    const { data: shifts } = await supabase
      .from("pos_shifts")
      .select("closing_cash, opening_cash")
      .eq("status", "closed")
      .gte("opened_at", start.toISOString())
      .lt("opened_at", end.toISOString());

    let revenue = 0;
    let count = 0;
    for (const s of shifts ?? []) {
      const diff =
        Number(s.closing_cash ?? 0) - Number(s.opening_cash ?? 0);
      if (diff > 0) {
        revenue += diff;
        count++;
      }
    }

    results.push({
      period,
      revenue,
      order_count: count,
      avg_order_value: count > 0 ? revenue / count : 0,
    });
  }

  return results;
}
