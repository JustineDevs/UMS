"use client";

import useSWR from "swr";

type RetentionMetric = {
  period: string;
  new_customers: number;
  returning_customers: number;
  retention_rate: number;
};

export function RetentionPanel() {
  const { data: response, isLoading: loading } = useSWR<{ data?: RetentionMetric[] }>(
    "/api/admin/analytics/retention?months=6",
    async (url) => {
      const result = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!result.ok) return { data: [] };
      return (await result.json()) as { data?: RetentionMetric[] };
    },
    { revalidateOnFocus: false },
  );
  const data = response?.data ?? [];

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Customer Retention
        </h3>
        <p className="text-sm text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
        Customer Retention (6 months)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No retention data available.</p>
      ) : (
        <div className="space-y-3">
          {data.map((m) => (
            <div key={m.period} className="flex items-center gap-4">
              <span className="text-xs font-mono w-16 text-on-surface-variant">{m.period}</span>
              <div className="flex-1 h-6 bg-surface-container-high rounded overflow-hidden flex">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${Math.min(m.retention_rate * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold w-12 text-right">
                {(m.retention_rate * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-on-surface-variant w-20 text-right">
                {m.returning_customers}R / {m.new_customers}N
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
