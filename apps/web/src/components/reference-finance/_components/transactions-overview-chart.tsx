"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" });
const chartConfig = {
  expense: { color: "var(--chart-4)", label: "Expense" },
  income: { color: "var(--chart-2)", label: "Income" },
} satisfies ChartConfig;

export function TransactionsOverviewChart({
  chartData,
  weekdayTicks,
  weekStart,
  weekEnd,
}: {
  chartData: { date: string; expense: number; income: number; timestamp: number }[];
  weekdayTicks: number[];
  weekStart: number;
  weekEnd: number;
}) {
  return (
    <ChartContainer config={chartConfig} className="h-50 w-full">
      <LineChart accessibilityLayer data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis axisLine={false} dataKey="timestamp" domain={[weekStart, weekEnd + DAY_MS]} scale="time" tickFormatter={(value) => weekdayFormatter.format(new Date(value))} tickLine={false} tickMargin={10} ticks={weekdayTicks} tick={{ fontSize: 12 }} type="number" />
        <YAxis hide axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
        <ChartTooltip
          cursor={false}
          content={({ active, payload, label }) => (
            <ChartTooltipContent active={active} hideLabel label={label} payload={payload?.map((item) => ({ ...item, value: typeof item.value === "number" ? formatCurrency(Number(item.value), { noDecimals: true }) : item.value }))} />
          )}
        />
        <Line connectNulls dataKey="income" dot={false} stroke="var(--color-income)" strokeDasharray="5 5" strokeLinecap="round" strokeWidth={1} type="linear" />
        <Line dataKey="expense" dot={false} stroke="var(--color-expense)" strokeLinecap="round" strokeWidth={3} type="linear" />
      </LineChart>
    </ChartContainer>
  );
}
