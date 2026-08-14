import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { isStaffRole, staffHasPermission, staffPermissionListForSession } from "@universal-music-store/database";

import { AdminPageShell } from "@/components/admin-console";
import { EcommerceReferenceDashboard, type EcommerceDashboardData } from "@/components/reference-ecommerce/EcommerceReferenceDashboard";
import { authOptions } from "@/lib/auth";
import { fetchMedusaInventoryPage } from "@/lib/medusa-inventory-bridge";
import { fetchMedusaOrdersForAdmin } from "@/lib/medusa-order-bridge";

export const dynamic = "force-dynamic";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function buildSalesOverview(orders: Array<{ created_at: string; grand_total: number }>) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (11 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      key,
      period: `${monthFormatter.format(date)} ${String(date.getFullYear()).slice(-2)}`,
      revenue: 0,
      orders: 0,
    };
  });
  const byKey = new Map(months.map((month) => [month.key, month]));

  for (const order of orders) {
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.revenue += order.grand_total;
    bucket.orders += 1;
  }

  return months.map(({ period, revenue, orders }) => ({ period, revenue, orders }));
}

function buildTopStockedProducts(
  rows: Array<{ productId: string; productName: string; available: number; size: string; color: string }>,
) {
  const byProduct = new Map<string, { name: string; category: string; stock: number }>();
  for (const row of rows) {
    if (!row.productId || row.available <= 0) continue;
    const current = byProduct.get(row.productId) ?? {
      name: row.productName || "Untitled product",
      category: [row.size, row.color].filter(Boolean).join(" / ") || "Variants",
      stock: 0,
    };
    current.stock += row.available;
    byProduct.set(row.productId, current);
  }

  const top = Array.from(byProduct.values())
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 3);
  const total = top.reduce((sum, product) => sum + product.stock, 0);

  return top.map((product) => ({
    ...product,
    share: total ? Math.round((product.stock / total) * 100) : 0,
  }));
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const session = await getServerSession(authOptions);

  const authDisabled = process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!authDisabled && (!session?.user || !isStaffRole(session.user.role ?? ""))) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  const canDashboard = authDisabled || staffHasPermission(staffPermissionListForSession(session), "dashboard:read");
  if (!canDashboard) {
    return (
      <AdminPageShell
        title="Store Overview"
        subtitle="Your account does not have dashboard access."
        bannerSlot={
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Ask an administrator to grant dashboard access. Reference: {denied ?? "dashboard:read"}
          </p>
        }
      >
        <p className="text-sm text-muted-foreground">Order and inventory metrics will appear here after access is granted.</p>
      </AdminPageShell>
    );
  }

  const [ordersResult, inventoryPage] = await Promise.all([
    fetchMedusaOrdersForAdmin(100, 0),
    fetchMedusaInventoryPage({ limit: 500, offset: 0 }),
  ]);
  const { orders } = ordersResult;
  const totalSales = orders.reduce((sum, order) => sum + order.grand_total, 0);
  const customerGrowth = new Set(orders.map((order) => order.customer_id ?? order.email).filter(Boolean)).size;
  const averageOrder = orders.length ? totalSales / orders.length : 0;
  const returnRequests = orders.filter((order) => /return|refund/i.test(order.status)).length;
  const inventory = inventoryPage.rows.reduce(
    (summary, row) => {
      if (row.available <= 0) summary.outOfStock += 1;
      else if (row.available <= 5) summary.lowStock += 1;
      else summary.inStock += 1;
      return summary;
    },
    { inStock: 0, lowStock: 0, outOfStock: 0 },
  );
  const inventoryTotal = inventory.inStock + inventory.lowStock + inventory.outOfStock;
  const dashboardData: EcommerceDashboardData = {
    totalSales,
    totalOrders: orders.length,
    customerGrowth,
    averageOrder,
    returnRequests,
    stockAccuracy: inventoryTotal ? Math.round((inventory.inStock / inventoryTotal) * 100) : 0,
    inventory,
    commerceUnavailable: ordersResult.commerceUnavailable,
    salesOverview: buildSalesOverview(orders),
    topProducts: buildTopStockedProducts(inventoryPage.rows),
    recentOrders: orders.slice(0, 50).map((order) => ({
      id: `#${order.order_number}`,
      backendId: order.id,
      date: order.created_at,
      customer: order.email ?? (order.customer_id ? "Customer" : "Guest"),
      payment: /refund|return/i.test(order.status) ? "Refunded" : /paid|ship|deliver/i.test(order.status) ? "Paid" : "Pending",
      total: `${order.currency} ${order.grand_total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      items: "Order",
      fulfillment: /return/i.test(order.status) ? "Returned" : /ship|deliver/i.test(order.status) ? "Fulfilled" : "Unfulfilled",
    })),
  };

  return (
    <AdminPageShell hideHeader bannerSlot={denied ? <p className="text-sm text-amber-800">Reference: {denied}</p> : null}>
      <EcommerceReferenceDashboard data={dashboardData} />
    </AdminPageShell>
  );
}
