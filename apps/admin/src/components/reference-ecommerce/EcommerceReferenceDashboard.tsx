import { format } from "date-fns";
import { Settings2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AdminPageHeader } from "@/components/admin-console";

import { CustomerReviews } from "./_components/customer-reviews";
import { Inventory } from "./_components/inventory";
import { KpiStrip } from "./_components/kpi-strip";
import { RecentOrders } from "./_components/recent-orders";
import { StoreTraffic } from "./_components/store-traffic";
import { TopProducts } from "./_components/top-products";
import { TrafficSources } from "./_components/traffic-sources";

export type EcommerceDashboardData = {
  totalSales: number;
  totalOrders: number;
  customerGrowth: number;
  averageOrder: number;
  returnRequests: number;
  stockAccuracy: number;
  inventory: { inStock: number; lowStock: number; outOfStock: number };
  commerceUnavailable?: boolean;
  salesOverview: { period: string; revenue: number; orders: number }[];
  topProducts: { name: string; category: string; share: number; stock: number }[];
  recentOrders: import("./_components/recent-orders-table/schema").OrderRow[];
};

export function EcommerceReferenceDashboard({ data }: { data?: EcommerceDashboardData }) {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title="Store Overview" subtitle={formattedDate} actions={<div className="flex flex-wrap items-center gap-2 lg:w-fit">
          <Select defaultValue="this-month">
            <SelectTrigger className="w-34" id="ecommerce-period" size="sm">
              <SelectValue placeholder="This Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                <SelectItem value="year-to-date">Year to Date</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="all-channels">
            <SelectTrigger className="w-40" id="ecommerce-channel" size="sm">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all-channels">All Channels</SelectItem>
                <SelectItem value="online-store">Online Store</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Separator orientation="vertical" />

          <Button aria-label="Open dashboard preferences" asChild size="icon-sm" variant="outline">
            <Link href="/admin/settings/preferences">
              <Settings2 />
            </Link>
          </Button>
      </div>} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <KpiStrip data={data} />
        <div className="xl:col-span-5">
          <StoreTraffic />
        </div>
        <div className="xl:col-span-7">
          <TrafficSources />
        </div>
        <div className="xl:col-span-4">
          <TopProducts products={data?.topProducts} />
        </div>
        <div className="xl:col-span-4">
          <Inventory data={data?.inventory} />
        </div>
        <div className="xl:col-span-4">
          <CustomerReviews />
        </div>
        <div className="xl:col-span-12">
          <RecentOrders orders={data?.recentOrders} />
        </div>
      </div>
    </div>
  );
}
