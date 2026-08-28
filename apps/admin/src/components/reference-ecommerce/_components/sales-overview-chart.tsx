"use client";

import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type SalesOverviewRow = {
  period: string;
  revenue: number;
  orders: number;
};

const config = {
  revenue: { label: "Revenue", color: "var(--foreground)" },
  orders: { label: "Orders", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

function formatCurrencyTooltipValue(value: unknown) {
  return typeof value === "number"
    ? value.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
    : String(value ?? "");
}

export function SalesOverviewChart({
  data,
  maxRevenue,
  maxOrders,
}: {
  data: SalesOverviewRow[];
  maxRevenue: number;
  maxOrders: number;
}) {
  return (
    <ChartContainer config={config} className="h-74 w-full">
      <ComposedChart id="sales-overview-chart" accessibilityLayer data={data} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
        <defs>
          <filter id="sales-line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="var(--color-revenue)" floodOpacity="0.35" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="period" axisLine={false} height={30} interval={0} minTickGap={0} tick={{ fontSize: 10 }} tickLine={false} tickMargin={8} />
        <YAxis yAxisId="revenue" hide domain={[0, maxRevenue]} />
        <YAxis yAxisId="orders" hide domain={[0, maxOrders]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="w-40"
              labelFormatter={(value) => String(value)}
              formatter={(value, name, item) => (
                <>
                  <div className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                  <div className="flex flex-1 items-center justify-between leading-none">
                    <span className="text-muted-foreground">{String(name ?? "")}</span>
                    <span className="font-medium font-mono text-foreground tabular-nums">
                      {name === "Orders" ? Number(value ?? 0).toLocaleString() : formatCurrencyTooltipValue(value)}
                    </span>
                  </div>
                </>
              )}
            />
          }
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
        />
        <Bar yAxisId="orders" barSize={4} dataKey="orders" fill="var(--color-orders)" isAnimationActive={false} name="Orders" opacity={0.18} radius={[6, 6, 0, 0]} />
        <Area yAxisId="revenue" dataKey="revenue" fill="none" filter="url(#sales-line-glow)" isAnimationActive={false} name="Revenue" stroke="var(--color-revenue)" strokeWidth={1.8} type="linear" activeDot={{ r: 4, fill: "var(--background)", stroke: "var(--color-revenue)", strokeWidth: 2 }} dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}
