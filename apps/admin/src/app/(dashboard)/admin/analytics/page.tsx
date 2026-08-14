import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@universal-music-store/ui";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { AnalyticsChartsPanel } from "@/components/AnalyticsChartsPanel";
import { fetchAnalyticsSummary, fetchValidatedAnalyticsCharts } from "@/lib/analytics-bridge";
import { fetchMedusaOrdersForAdmin } from "@/lib/medusa-order-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";
import { RetentionPanel } from "./RetentionPanel";
import { SalesTrendsPanel } from "./SalesTrendsPanel";
import { AnalyticsPeriodSelect } from "./AnalyticsPeriodSelect";
import { MetricActions } from "./MetricActions";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requirePagePermission("analytics:read");
  const requestedPeriod = Number((await searchParams).period);
  const horizonDays = [30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 30;
  const [summary, charts, ordersResult] = await Promise.all([
    fetchAnalyticsSummary(),
    fetchValidatedAnalyticsCharts(horizonDays),
    fetchMedusaOrdersForAdmin(500, 0),
  ]);
  const customerCount = new Set(ordersResult.orders.map((order) => order.customer_id).filter(Boolean)).size;
  const averageOrder = summary.orderCount ? summary.revenueTotal / summary.orderCount : 0;
  const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: summary.currency, maximumFractionDigits: 2 });
  const kpis = [
    ["Customer Accounts", customerCount.toLocaleString(), "Unique customers in orders", true],
    ["Sessions", summary.orderCount.toLocaleString(), "Recorded orders", true],
    ["Revenue", money.format(summary.revenueTotal), `Total ${summary.currency} revenue`, true],
    ["Average Order", money.format(averageOrder), "Revenue per order", true],
    ["Pending Orders", summary.pendingCount.toLocaleString(), "Awaiting payment or fulfillment", false],
  ] as const;

  return <AdminPageShell title="Analytics" subtitle="Monitor commerce performance, order health, and retention in one view." breadcrumbs={<AdminBreadcrumbs items={[{ label: "Dashboard", href: "/admin" }, { label: "Analytics" }]} />} inspector={<AuditTimeline title="Recent activity" />}>
    <Tabs defaultValue="overview">
      <div className="flex flex-wrap items-center justify-between gap-3"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="retention">Retention</TabsTrigger><TabsTrigger value="trends">Trends</TabsTrigger></TabsList><div className="flex items-center gap-2"><AnalyticsPeriodSelect /><Link href="/admin/orders" aria-label="Open orders from analytics" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"><ArrowUpRight className="size-3.5" />Orders</Link></div></div>
      <TabsContent value="overview" className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"><div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">{kpis.map(([label, value, detail, positive]) => <Card key={label} className="rounded-none border-0 ring-0"><CardHeader><CardTitle className="text-sm font-normal">{label}</CardTitle><div className="absolute right-4 top-4"><MetricActions label={label} value={String(value)} /></div></CardHeader><CardContent><div className="flex items-center justify-between gap-3"><div className="text-2xl leading-none tracking-tight tabular-nums">{value}</div><Badge variant={positive ? "outline" : "destructive"}><span className="material-symbols-outlined text-xs">{positive ? "north_east" : "south_east"}</span> {positive ? "Live" : "Review"}</Badge></div><p className="mt-3 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}</div></div>
        {charts ? <AnalyticsChartsPanel payload={charts} /> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Analytics chart data is unavailable. Refresh after the store service is ready.</CardContent></Card>}
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12"><div className="xl:col-span-7"><Card className="h-full"><CardHeader><CardTitle className="font-normal">Page Performance</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead className="border-y text-left"><tr><th className="px-4 py-3 font-normal">Metric</th><th className="px-4 py-3 text-right font-normal">Value</th></tr></thead><tbody>{[["Orders", summary.orderCount], ["Paid or shipped", summary.paidCount], ["Pending", summary.pendingCount], ["Average order", money.format(averageOrder)]].map(([label, value]) => <tr className="border-b last:border-0" key={String(label)}><td className="px-4 py-3 font-medium">{label}</td><td className="px-4 py-3 text-right tabular-nums">{value}</td></tr>)}</tbody></table></CardContent></Card></div><div className="xl:col-span-5"><Card className="h-full"><CardHeader><CardTitle className="font-normal">Order Status</CardTitle></CardHeader><CardContent className="space-y-3">{charts?.statusBreakdown.length ? charts.statusBreakdown.map((status) => <div className="flex items-center justify-between gap-4 text-sm" key={status.name}><span className="capitalize">{status.name}</span><span className="tabular-nums text-muted-foreground">{status.value}</span></div>) : <p className="text-sm text-muted-foreground">No orders in this period.</p>}</CardContent></Card></div></div>
      </TabsContent>
      <TabsContent value="orders"><AnalyticsChartsPanel payload={charts} /></TabsContent>
      <TabsContent value="retention"><RetentionPanel /></TabsContent>
      <TabsContent value="trends"><SalesTrendsPanel /></TabsContent>
    </Tabs>
  </AdminPageShell>;
}
