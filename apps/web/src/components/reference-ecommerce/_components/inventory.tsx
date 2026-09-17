"use client";

import { ArrowUpRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const InventoryGauge = dynamic(() => import("./inventory-gauge").then((module) => module.InventoryGauge), {
  loading: () => <div className="mx-auto h-30 w-full animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />,
  ssr: false,
});

const gaugeSegmentCount = 32;

export function Inventory({ data }: { data?: { inStock: number; lowStock: number; outOfStock: number } }) {
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
        <InventoryGauge availablePercent={availablePercent} gaugeSegments={gaugeSegments} />
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
