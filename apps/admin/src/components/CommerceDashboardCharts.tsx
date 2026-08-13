"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsChartsPayload } from "@/lib/analytics-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@universal-music-store/ui";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CommerceDashboardCharts({ payload }: { payload: AnalyticsChartsPayload | null }) {
  if (!payload) {
    return (
      <Card className="h-full">
        <CardHeader><CardTitle className="font-normal">Sales Overview</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Sales data is unavailable.</p></CardContent>
      </Card>
    );
  }

  const daily = payload.daily.map((row) => ({
    ...row,
    label: new Date(`${row.date}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="font-normal">Sales Overview</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="admin-sales-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(var(--admin-primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="rgb(var(--admin-primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(value) => `${value}`} />
              <Tooltip formatter={(value: number) => money(value, payload.currency)} />
              <Area type="monotone" dataKey="revenue" stroke="rgb(var(--admin-primary))" fill="url(#admin-sales-fill)" strokeWidth={2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-normal">Orders by day</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <Tooltip />
              <Bar dataKey="orderCount" fill="rgb(var(--admin-primary))" radius={[4, 4, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
