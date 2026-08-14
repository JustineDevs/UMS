import Link from "next/link";
import {
  AdminBreadcrumbs,
  AdminPageShell,
  AuditTimeline,
} from "@/components/admin-console";
import {
  fetchMedusaCustomerById,
  fetchMedusaOrdersForCustomer,
} from "@/lib/customers-bridge";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function CrmCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  await requirePagePermission("crm:read");
  const { customerId } = await params;
  const customer = await fetchMedusaCustomerById(customerId);
  if (!customer) {
    return (
      <AdminPageShell
        title="Customer unavailable"
        subtitle="No customer record for this id, or the commerce service returned no data."
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "CRM", href: "/admin/crm" },
              { label: "Unavailable" },
            ]}
          />
        }
      >
        <Link href="/admin/crm" className="text-sm font-semibold text-primary underline">
          Back to CRM
        </Link>
      </AdminPageShell>
    );
  }

  const orders = await fetchMedusaOrdersForCustomer(customerId, 100);

  return (
    <AdminPageShell
      title={
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        customer.email ||
        "Customer"
      }
      subtitle={customer.email ?? "No email on file"}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "CRM", href: "/admin/crm" },
            { label: "Customer" },
          ]}
        />
      }
      inspector={<AuditTimeline title="Recent activity" />}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Profile
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Contact and account identity from Medusa remains the source of truth.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Email</dt>
              <dd className="font-medium">{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Account</dt>
              <dd>{customer.has_account ? "Registered" : "Guest profile"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Commerce context
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Order history, fulfillment state, and totals stay linked to the same customer identity.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Orders</dt>
              <dd className="font-medium">{orders.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Customer ID</dt>
              <dd className="break-all font-mono text-xs">{customer.id}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            CRM bridge
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Linked account rows, contact sync, and deal sync live in the CRM bridge tables.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/segments" className="text-sm font-semibold text-primary hover:underline">
              Segments
            </Link>
            <Link href="/admin/campaigns" className="text-sm font-semibold text-primary hover:underline">
              Campaigns
            </Link>
            <Link href="/admin/loyalty" className="text-sm font-semibold text-primary hover:underline">
              Loyalty
            </Link>
            <Link href="/admin/analytics" className="text-sm font-semibold text-primary hover:underline">
              Analytics
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="mb-4 font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Orders ({orders.length})
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No orders linked to this customer in the store.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-outline-variant/15 overflow-y-auto text-sm">
                {orders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium text-primary">#{order.display_id}</p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {order.status.replace(/_/g, " ")} ·{" "}
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {order.currency_code}{" "}
                        {(order.total_minor / 100).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <Link
                        href={`/admin/orders/${encodeURIComponent(order.id)}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Open order
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Notes and activity
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Staff notes are the current CRM timeline primitive for this customer. They are paired with
              the audit inspector on the right.
            </p>
            <div className="mt-4 rounded-xl border border-outline-variant/15 bg-white p-4 text-sm text-on-surface-variant">
              Add and manage notes from the CRM notes API. Deleted notes are soft-deleted for auditability.
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Related routes
            </h2>
            <div className="mt-4 grid gap-2 text-sm">
              {[
                ["/admin/crm", "CRM hub"],
                ["/admin/segments", "Segments"],
                ["/admin/campaigns", "Campaigns"],
                ["/admin/loyalty", "Loyalty"],
                ["/admin/analytics", "Analytics"],
                ["/admin/cms/forms", "Lead capture forms"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-lg border border-outline-variant/15 bg-white px-3 py-2 font-medium text-primary hover:bg-surface-container-low"
                >
                  <span>{label}</span>
                  <span className="text-xs text-on-surface-variant">{href}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Bridge summary
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              This customer view covers contact identity, order context, notes, and the linked route map.
              The contact and deal sync rows themselves live in the CRM bridge tables.
            </p>
          </section>
        </div>
      </div>
    </AdminPageShell>
  );
}
