import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { fetchWorkerOrdersForAdmin } from "@/lib/worker-admin-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";
import { CreateOrderButton, OrdersTable } from "./OrdersTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requirePagePermission("orders:read");
  const { orders, total } = await fetchWorkerOrdersForAdmin();

  return (
    <AdminPageShell
      title="Orders"
      subtitle={`${total} total orders.`}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Orders" }]}
        />
      }
      actions={<CreateOrderButton />}
    >
      <OrdersTable orders={orders} total={total} />
    </AdminPageShell>
  );
}
