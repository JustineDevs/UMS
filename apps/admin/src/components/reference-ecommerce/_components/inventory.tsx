"use client";

import { ArrowUpRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Label, Pie, PieChart } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";

const gaugeSegmentCount = 32;

const chartConfig = {
  "in-stock": {
    label: "In stock",
    color: "var(--chart-2)",
  },
  "low-stock": {
    label: "Low stock",
    color: "var(--chart-1)",
  },
  "out-of-stock": {
    label: "Out of stock",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export function Inventory({ data }: { data?: { inStock: number; lowStock: number; outOfStock: number } }) {
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => setChartReady(true), []);

  const inventory = data ?? { inStock: 0, lowStock: 0, outOfStock: 0 };
  const totalUnits = inventory.inStock + inventory.lowStock + inventory.outOfStock;
  const availablePercent = totalUnits ? Math.round((inventory.inStock / totalUnits) * 100) : 0;
  const inStockSegments = Math.round((inventory.inStock / Math.max(totalUnits, 1)) * gaugeSegmentCount);
  const lowStockSegments = Math.round((inventory.lowStock / Math.max(totalUnits, 1)) * gaugeSegmentCount);
  const gaugeSegments = Array.from({ length: gaugeSegmentCount }, (_, index) => {
    const status = index < inStockSegments ? "in-stock" : index < inStockSegments + lowStockSegments ? "low-stock" : "out-of-stock";
    return { fill: `var(--color-${status})`, id: `segment-${index + 1}`, status, value: 1 };
  });
  const inventorySummary = [
    { icon: PackageCheck, label: "In stock", value: inventory.inStock },
    { icon: TriangleAlert, label: "Low stock", value: inventory.lowStock },
    { icon: PackageX, label: "Out", value: inventory.outOfStock },
  ] as const;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Inventory</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {availablePercent}% available
        </CardDescription>
        <CardAction>
          <Button aria-label="Open inventory" asChild size="icon-sm" variant="ghost">
            <Link href="/admin/inventory">
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {chartReady ? (
          <ChartContainer config={chartConfig} className="mx-auto h-30 w-full">
            <PieChart>
              <Pie
                cx="50%"
                cy="100%"
                cornerRadius={6}
                data={gaugeSegments}
                dataKey="value"
                endAngle={0}
                id="inventory-gauge"
                innerRadius={80}
                isAnimationActive
                outerRadius={110}
                paddingAngle={2}
                startAngle={180}
                stroke="var(--card)"
                strokeWidth={1}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                          <tspan
                            className="fill-foreground font-medium text-2xl tabular-nums"
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 22}
                          >
                            {availablePercent}%
                          </tspan>
                          <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy || 0) + 38}>
                            Available
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="mx-auto h-30 w-full animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />
        )}
        <Separator />

        <div className="grid grid-cols-3 divide-x">
          {inventorySummary.map((item, _index) => (
            <div key={item.label} className="flex flex-col items-center gap-3 text-center">
              <div className="grid size-9 place-items-center rounded-full bg-muted">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
                <div className="font-medium text-sm tabular-nums">{item.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
