import Link from "next/link";
import {
  AdminBreadcrumbs,
  AdminPageShell,
  AuditTimeline,
} from "@/components/admin-console";
import {
  FulfillmentPanel,
  type ShipmentRow,
} from "@/components/FulfillmentPanel";
import { OrderRefundPanel } from "@/components/OrderRefundPanel";
import {
  fetchMedusaOrderDetailForAdmin,
  fetchMedusaOrderPaymentsForAdmin,
} from "@/lib/medusa-order-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requirePagePermission("orders:read");
  const { orderId } = await params;
  const result = await fetchMedusaOrderDetailForAdmin(orderId);
  const order = result?.order ?? null;
  const shipments: ShipmentRow[] = result?.shipments ?? [];
  const payments = order ? await fetchMedusaOrderPaymentsForAdmin(order.id) : [];

  if (!order) {
    return (
      <AdminPageShell title="Order unavailable" subtitle="No order matches this reference, or it is no longer available.">
        <Link href="/admin/orders" className="mt-4 inline-block text-primary underline">
          Back to orders
        </Link>
      </AdminPageShell>
    );
  }

  const items = order.order_items ?? [];

  return (
    <AdminPageShell
      title={order.order_number}
      subtitle={`${order.channel} · ${order.status.replace(/_/g, " ")} · ${order.currency} ${Number(order.grand_total).toLocaleString("en-PH")}`}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Orders", href: "/admin/orders" },
            { label: order.order_number },
          ]}
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/admin/receipts?order_id=${encodeURIComponent(order.id)}`}
            className="text-sm font-semibold text-on-surface-variant hover:underline"
          >
            Digital receipt
          </Link>
          <Link
            href="/admin/orders"
            className="text-sm font-semibold text-primary hover:underline"
          >
            All orders
          </Link>
        </div>
      }
      inspector={<AuditTimeline title="Activity" />}
      footNote={
        <span className="text-on-surface-variant">
          Created {new Date(order.created_at).toLocaleString("en-PH")}
        </span>
      }
    >
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 lg:grid-cols-2">
        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
          <h2 className="mb-4 font-headline text-sm font-bold uppercase tracking-widest text-primary">
            Line items
          </h2>
          {items.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No line items.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {items.map((li) => (
                <li
                  key={li.id}
                  className="border-b border-outline-variant/10 pb-3 last:border-0"
                >
                  <p className="font-medium text-primary">{li.product_name_snapshot}</p>
                  <p className="text-xs text-on-surface-variant">
                    {li.sku_snapshot} · {li.size_snapshot} / {li.color_snapshot} × {li.quantity}
                  </p>
                  <p className="mt-1 text-on-surface-variant">
                    {order.currency} {Number(li.line_total).toLocaleString("en-PH")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6">
          <h2 className="mb-4 font-headline text-sm font-bold uppercase tracking-widest text-primary">
            Sale details
          </h2>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded bg-surface-container-low p-3">
              <p className="text-xs text-on-surface-variant">Order tag</p>
              <p className="mt-1 font-medium">{String(order.metadata.pos_order_tag ?? "Not set")}</p>
            </div>
            <div className="rounded bg-surface-container-low p-3">
              <p className="text-xs text-on-surface-variant">E-invoice</p>
              <p className="mt-1 font-medium">{order.metadata.e_invoice_requested === true ? "Requested" : "Not requested"}</p>
            </div>
            {order.metadata.e_invoice_requested === true ? (
              <div className="rounded bg-surface-container-low p-3 sm:col-span-2">
                <p className="text-xs text-on-surface-variant">Invoice contact</p>
                <p className="mt-1 font-medium">
                  {String(order.metadata.e_invoice_customer_email ?? "No email provided")}
                  {order.metadata.e_invoice_customer_tin ? ` · Tax ID ${String(order.metadata.e_invoice_customer_tin)}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-8">
          <OrderRefundPanel
            orderId={order.id}
            currency={order.currency}
            payments={payments}
          />
          <FulfillmentPanel
            orderId={order.id}
            initialStatus={order.status}
            initialShipments={shipments}
          />
        </div>
      </div>
    </AdminPageShell>
  );
}
