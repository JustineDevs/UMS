"use client";

import { Label, Pie, PieChart } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { FinanceBalancePoint } from "./balance-distribution-card";

const chartConfig = {
  amount: { label: "Balance" },
  investment: { color: "var(--chart-1)", label: "Investment Account" },
  main: { color: "var(--chart-2)", label: "Main Wallet" },
  reserve: { color: "var(--chart-3)", label: "Reserve Account" },
  savings: { color: "var(--chart-4)", label: "Savings Account" },
} satisfies ChartConfig;

export function BalanceDistributionChart({
  balanceData,
  totalBalance,
  currency,
}: {
  balanceData: (FinanceBalancePoint & { fill?: string })[];
  totalBalance: number;
  currency: "PHP";
}) {
  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-50">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="w-52" nameKey="account" />} />
        <Pie cornerRadius={6} data={balanceData} dataKey="amount" id="finance-balance-distribution" innerRadius={65} nameKey="account" outerRadius={90} paddingAngle={2} strokeWidth={5}>
          <Label
            content={({ viewBox }) => {
              if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) return null;
              return (
                <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                  <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 8}>Total</tspan>
                  <tspan className="fill-foreground font-medium text-lg tabular-nums" x={viewBox.cx} y={(viewBox.cy ?? 0) + 14}>
                    {formatCurrency(totalBalance, { currency, noDecimals: true })}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
