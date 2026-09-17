"use client";

import { ArrowUpRight, Banknote, PackageCheck, ReceiptText, RotateCcw, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EcommerceDashboardData } from "../EcommerceReferenceDashboard";

const SalesOverviewChart = dynamic(
  () => import("./sales-overview-chart").then((module) => module.SalesOverviewChart),
  { ssr: false },
);

export function KpiStrip({ data }: { data?: EcommerceDashboardData }) {
  const [mounted, setMounted] = useState(false);
  const totalSales = data?.totalSales ?? 0;
  const totalOrders = data?.totalOrders ?? 0;
  const customerGrowth = data?.customerGrowth ?? 0;
  const averageOrder = data?.averageOrder ?? 0;
  const returnRequests = data?.returnRequests ?? 0;
  const stockAccuracy = data?.stockAccuracy ?? 0;
  const salesOverviewData = data?.salesOverview ?? [];
  const hasSalesOverview = salesOverviewData.some((row) => row.revenue > 0 || row.orders > 0);
  const maxRevenue = Math.max(1, ...salesOverviewData.map((row) => row.revenue));
  const maxOrders = Math.max(1, ...salesOverviewData.map((row) => row.orders));
  const metricNote = data?.commerceUnavailable ? "Commerce unavailable" : "From live Medusa data";

  useEffect(() => setMounted(true), []);

  return (
    <div className="h-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 xl:col-span-12">
      <div>
        <div className="grid grid-cols-1 xl:grid-cols-12">
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-3 xl:col-span-5 xl:border-r">
            <Card className="h-full rounded-none border-0 border-border border-b ring-0 md:border-r">
              <CardHeader>
                <CardTitle className="font-normal text-sm">Loaded Sales</CardTitle>
                <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                  {totalSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                </CardDescription>
                <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                  <Banknote className="size-3 text-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm">{metricNote}</div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-none border-0 border-border border-b ring-0">
              <CardHeader>
                <CardTitle className="font-normal text-sm">Loaded Orders</CardTitle>
                <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                  {totalOrders.toLocaleString()}
                </CardDescription>
                <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                  <ShoppingBag className="size-3 text-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm">Fetched from recent orders</div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-none border-0 border-border border-b ring-0 md:border-r">
              <CardHeader>
                <CardTitle className="font-normal text-sm">Known Customers</CardTitle>
                <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                  {customerGrowth.toLocaleString()}
                </CardDescription>
                <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                  <Users className="size-3 text-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm">Unique customer identifiers</div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-none border-0 border-border border-b ring-0">
              <CardHeader>
                <CardTitle className="font-normal text-sm">Average Order</CardTitle>
                <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                  {averageOrder.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })}
                </CardDescription>
                <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                  <ReceiptText className="size-3 text-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm">Calculated from loaded orders</div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-none border-0 border-border border-b ring-0 md:border-r md:border-b-0">
              <CardHeader>
                <CardTitle className="font-normal text-sm">Return Requests</CardTitle>
                <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                  {returnRequests.toLocaleString()}
                </CardDescription>
                <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                  <RotateCcw className="size-3 text-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm">Refund or return statuses</div>
              </CardContent>
            </Card>

            <Card className="h-full rounded-none border-0 ring-0">
              <CardHeader>
                <CardTitle className="font-normal text-sm">Stock Accuracy</CardTitle>
                <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                  {stockAccuracy}%
                </CardDescription>
                <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                  <PackageCheck className="size-3 text-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-sm">Inventory availability ratio</div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-full rounded-none border-0 ring-0 xl:col-span-7">
            <CardHeader>
              <CardTitle className="font-normal">Sales Overview</CardTitle>
              <CardAction>
                <Button aria-label="Open analytics" asChild size="icon-sm" variant="ghost">
                  <Link href="/admin/analytics">
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent>
              {hasSalesOverview && mounted ? (
                <SalesOverviewChart data={salesOverviewData} maxRevenue={maxRevenue} maxOrders={maxOrders} />
              ) : (
                <div className="flex h-74 items-center justify-center rounded-lg border border-dashed text-center">
                  <div className="max-w-xs px-6">
                    <div className="font-medium text-sm">{mounted ? "No sales chart yet" : "Loading sales chart…"}</div>
                    <div className="mt-1 text-muted-foreground text-sm">
                      Revenue history will appear after Medusa returns dated orders.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
