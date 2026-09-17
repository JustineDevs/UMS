"use client";

import { Label, Pie, PieChart } from "recharts";

import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

const chartConfig = {
  "in-stock": { label: "In stock", color: "var(--chart-2)" },
  "low-stock": { label: "Low stock", color: "var(--chart-1)" },
  "out-of-stock": { label: "Out of stock", color: "var(--destructive)" },
} satisfies ChartConfig;

type GaugeSegment = { fill: string; id: string; status: string; value: number };

export function InventoryGauge({
  availablePercent,
  gaugeSegments,
}: {
  availablePercent: number;
  gaugeSegments: GaugeSegment[];
}) {
  return (
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
              if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) return null;
              return (
                <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                  <tspan className="fill-foreground font-medium text-2xl tabular-nums" x={viewBox.cx} y={(viewBox.cy || 0) + 22}>
                    {availablePercent}%
                  </tspan>
                  <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy || 0) + 38}>
                    Available
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
