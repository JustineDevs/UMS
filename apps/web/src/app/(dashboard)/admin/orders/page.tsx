import Link from "next/link";
import { AdminBreadcrumbs, AdminPageShell, AuditTimeline } from "@/components/admin-console";
import { fetchWorkerOrdersForAdmin } from "@/lib/worker-admin-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";

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
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <div className="overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0px_20px_40px_rgba(0,0,0,0.02)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container-high">
              <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Order
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Customer
              </th>
              <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Status
              </th>
              <th className="text-right py-4 px-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-16 text-center text-on-surface-variant"
                >
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-surface-container-high/50"
                >
                  <td className="py-4 px-6 font-medium text-primary">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="py-4 px-6 text-on-surface-variant text-sm">
                    {o.email ?? (o.customer_id ? "Customer" : "Guest")}
                  </td>
                  <td className="py-4 px-6 text-on-surface-variant text-sm">
                    {o.status.replace(/_/g, " ")}
                  </td>
                  <td className="py-4 px-6 text-right font-medium">
                    {o.currency} {Number(o.grand_total).toLocaleString("en-PH")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
