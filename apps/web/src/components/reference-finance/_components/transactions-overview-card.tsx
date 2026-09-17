"use client";

import dynamic from "next/dynamic";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TransactionsOverviewChart = dynamic(
  () => import("./transactions-overview-chart").then((module) => module.TransactionsOverviewChart),
  {
    loading: () => <div className="h-50 w-full animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />,
    ssr: false,
  },
);

const DAY_MS = 24 * 60 * 60 * 1000;

export type FinanceTransactionPoint = {
  date: string;
  expense: number;
  income: number;
};

export function TransactionsOverviewCard({ data }: { data: FinanceTransactionPoint[] }) {
  const chartData = data.map((item) => ({ ...item, timestamp: Date.parse(item.date) }));
  const timestamps = chartData.map((item) => item.timestamp);
  const weekStart = timestamps[0] ?? Date.now() - 6 * DAY_MS;
  const weekEnd = timestamps.at(-1) ?? Date.now();
  const weekdayTicks = Array.from({ length: 7 }, (_, index) => weekStart + (index + 0.5) * DAY_MS);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Spending Overview</CardTitle>
        <CardAction>
          <Select defaultValue="weekly">
            <SelectTrigger className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent>
        <TransactionsOverviewChart chartData={chartData} weekdayTicks={weekdayTicks} weekStart={weekStart} weekEnd={weekEnd} />
      </CardContent>
    </Card>
  );
}
