"use client";

import useSWR from "swr";

type SalesTrend = {
  period: string;
  revenue: number;
  order_count: number;
  avg_order_value: number;
};

export function SalesTrendsPanel() {
  const { data: response, isLoading: loading } = useSWR<{ data?: SalesTrend[] }>(
    "/api/admin/analytics/sales-trends?months=6",
    async (url) => {
      const result = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!result.ok) return { data: [] };
      return (await result.json()) as { data?: SalesTrend[] };
    },
    { revalidateOnFocus: false },
  );
  const data = response?.data ?? [];

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Sales Trends
        </h3>
        <p className="text-sm text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
        Sales Trends (6 months)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No sales data available.</p>
      ) : (
        <div className="space-y-3">
          {data.map((m) => (
            <div key={m.period} className="flex items-center gap-4">
              <span className="text-xs font-mono w-16 text-on-surface-variant">{m.period}</span>
              <div className="flex-1 h-6 bg-surface-container-high rounded overflow-hidden">
                <div
                  className="bg-secondary h-full transition-[width]"
                  style={{ width: `${(m.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold w-24 text-right">
                PHP {m.revenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-on-surface-variant w-16 text-right">
                {m.order_count} orders
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
