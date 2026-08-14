"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@universal-music-store/ui";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  analyticsChartsPayloadSchema,
  type AnalyticsChartsPayload,
} from "@/lib/analytics-chart";

const CHART_PRIMARY = "#000000";
const CHART_BAR = "#1b5e3a";
const PIE_COLORS = [
  "#000000",
  "#1b5e3a",
  "#b45309",
  "#6b21a8",
  "#9f1239",
  "#0b4f6c",
];

type Props = {
  payload: unknown;
};

function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function AnalyticsChartsPanel({ payload }: Props) {
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => setChartReady(true), []);

  const parsed = useMemo(
    () => analyticsChartsPayloadSchema.safeParse(payload),
    [payload],
  );

  if (!parsed.success) {
    return (
      <section className="mt-10" aria-live="polite">
        <Alert>
          <AlertDescription className="text-sm leading-relaxed text-on-surface-variant">
            Chart data is unavailable. Refresh the page. If the issue continues,
            contact support with the time it occurred.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const data: AnalyticsChartsPayload = parsed.data;
  const dailyChart = data.daily.map((row) => ({
    ...row,
    label: formatShortDate(row.date),
  }));

  return (
    <section className="mt-10 space-y-8">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <ChartCard title={`Revenue (${data.currency}) — last ${data.daily.length} days`}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={dailyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#c6c6c6" strokeOpacity={0.6} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#c6c6c6" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#c6c6c6" }}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #c6c6c6",
                  fontSize: 12,
                }}
                formatter={(value: number) => [
                  value.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                  `Revenue (${data.currency})`,
                ]}
                labelFormatter={(_, items) => {
                  const row = items?.[0]?.payload as { date?: string } | undefined;
                  return row?.date ?? "";
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={CHART_PRIMARY}
                strokeWidth={2}
                fill="url(#analyticsRevenueFill)"
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders per day">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dailyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#c6c6c6" strokeOpacity={0.6} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#c6c6c6" }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#c6c6c6" }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #c6c6c6",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="orderCount"
                name="Orders"
                fill={CHART_BAR}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Orders by status">
        {data.statusBreakdown.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No orders in this window.</p>
        ) : (
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
          <ResponsiveContainer width="100%" height={300} className="max-w-md">
            <PieChart>
              <Pie
                data={data.statusBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                id="analytics-status-breakdown"
                innerRadius={56}
                isAnimationActive={chartReady}
                outerRadius={96}
                paddingAngle={2}
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {data.statusBreakdown.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #c6c6c6",
                  fontSize: 12,
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <ul className="w-full max-w-sm space-y-2 text-sm text-on-surface-variant lg:pt-8">
            {data.statusBreakdown.map((row, i) => (
              <li
                key={row.name}
                className="flex items-center justify-between gap-4 border-b border-outline-variant/15 pb-2 last:border-0"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                    aria-hidden
                  />
                  <span className="font-medium text-primary">{row.name}</span>
                </span>
                <span>{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
        )}
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-secondary">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
