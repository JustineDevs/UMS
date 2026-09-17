"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

const BalanceDistributionChart = dynamic(
  () => import("./balance-distribution-chart").then((module) => module.BalanceDistributionChart),
  {
    loading: () => <div className="mx-auto aspect-square h-50 animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />,
    ssr: false,
  },
);

type BalanceKey = "investment" | "main" | "reserve" | "savings";

const accountColors: Record<BalanceKey, string> = {
  investment: "var(--chart-1)",
  main: "var(--chart-2)",
  reserve: "var(--chart-3)",
  savings: "var(--chart-4)",
};

export type FinanceBalancePoint = {
  account: string;
  amount: number;
  key: BalanceKey;
  percentage: number;
};

const currencies = {
  PHP: {
    label: "PHP Balance",
  },
} as const;

type Currency = keyof typeof currencies;

const getAccountColor = (key: BalanceKey) => {
  return accountColors[key];
};

export function BalanceDistributionCard({ balanceData }: { balanceData: FinanceBalancePoint[] }) {
  const [currency, setCurrency] = React.useState<Currency>("PHP");
  const chartData = balanceData.map((item) => ({ ...item, fill: getAccountColor(item.key) }));
  const totalBalance = balanceData.reduce((total, item) => total + item.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Account Allocation</CardTitle>
        <CardAction>
          <Select onValueChange={(value) => setCurrency(value as Currency)} value={currency}>
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(currencies).map(([value, item]) => (
                  <SelectItem key={value} value={value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <BalanceDistributionChart
          balanceData={chartData}
          totalBalance={totalBalance}
          currency={currency}
        />

        <div className="flex min-w-0 flex-col gap-3">
          {chartData.map((item) => (
            <div className="grid grid-cols-[1fr_auto] items-end gap-3" key={item.key}>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <span aria-hidden="true" className="h-2 w-1 rounded-full" style={{ backgroundColor: item.fill }} />
                  <p className="truncate text-muted-foreground text-xs">{item.account}</p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatCurrency(item.amount, { currency, noDecimals: true })}
                </p>
              </div>
              <div className="font-medium tabular-nums">{item.percentage}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
