import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderCancelButton } from "@/components/OrderCancelButton";
import { getStorefrontSession } from "@/lib/auth";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { findMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";
import { accountOrderMatchesCustomer } from "@/lib/medusa-account-orders";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type OrderItemRow = {
  id?: string;
  title?: string | null;
  quantity?: number;
  unit_price?: number;
  total?: number;
  variant?: { sku?: string | null } | null;
};

type FulfillmentRow = {
  id?: string;
  status?: string;
  provider_id?: string;
  shipped_at?: string | null;
  tracking_numbers?: string[] | null;
  labels?: Array<{ tracking_number?: string | null } | null> | null;
};

type OrderRow = {
  id?: string;
  customer_id?: string | null;
  display_id?: string | number;
  email?: string | null;
  status?: string;
  total?: number;
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  currency_code?: string;
  created_at?: string;
  updated_at?: string;
  payment_status?: string;
  fulfillment_status?: string;
  metadata?: Record<string, unknown> | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    address_1?: string | null;
    address_2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
  } | null;
  items?: OrderItemRow[] | null;
  fulfillments?: FulfillmentRow[] | null;
};

function formatMoney(amount: number | undefined, currency = "PHP") {
  return `${currency} ${(amount ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(value: string | undefined) {
  return (value ?? "unknown").replace(/_/g, " ");
}

function orderStatusSteps(status: string | undefined) {
  const steps = ["pending_payment", "paid", "ready_to_ship", "shipped", "delivered"];
  const currentIndex = steps.indexOf(String(status ?? ""));
  return { steps, currentIndex: currentIndex >= 0 ? currentIndex : 0 };
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await getStorefrontSession();
  const userEmail = session?.user?.email?.trim().toLowerCase();
  if (!session || !userEmail) {
    redirect(`/sign-in?callbackUrl=/account/orders/${encodeURIComponent(orderId)}`);
  }

  if (!orderId?.startsWith("order_")) {
    notFound();
  }

  const sessionCustomerId =
    typeof (session.user as Record<string, unknown>).medusaCustomerId === "string"
      ? String((session.user as Record<string, unknown>).medusaCustomerId).trim()
      : "";
  const customerId = sessionCustomerId || (await findMedusaCustomerIdByEmail(userEmail));
  if (!customerId) {
    notFound();
  }

  const res = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?fields=id,customer_id,display_id,email,status,total,subtotal,tax_total,shipping_total,discount_total,currency_code,created_at,updated_at,payment_status,fulfillment_status,shipping_address,*items,*items.id,*items.title,*items.quantity,*items.unit_price,*items.total,*items.variant,+metadata,*fulfillments,*fulfillments.id,*fulfillments.status,*fulfillments.provider_id,*fulfillments.shipped_at,*fulfillments.tracking_numbers,*fulfillments.labels`,
  );
  if (!res.ok) {
    notFound();
  }

  const json = (await res.json()) as { order?: OrderRow };
  const order = json.order;
  if (!order?.id) {
    notFound();
  }

  if (!accountOrderMatchesCustomer(order.customer_id, customerId)) {
    notFound();
  }

  const orderEmail = order.email?.trim().toLowerCase();
  if (!orderEmail || orderEmail !== userEmail) {
    notFound();
  }

  const currency = String(order.currency_code ?? "PHP").toUpperCase();
  const displayId =
    order.display_id != null ? String(order.display_id) : String(order.id);
  const { steps, currentIndex } = orderStatusSteps(order.status);

  return (
    <main className="storefront-page-shell max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-xs text-on-surface-variant">
        <Link href="/account" className="hover:text-primary">
          Account
        </Link>
        <span aria-hidden="true" className="select-none">/</span>
        <span className="text-primary font-medium" aria-current="page">
          Order {displayId}
        </span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary">
            Order #{displayId}
          </h1>
          <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm text-on-surface-variant sm:grid-cols-3" aria-label="Order state summary">
            <div>
              <dt className="text-xs uppercase tracking-wide">Order status</dt>
              <dd className="font-medium text-primary">{formatStatus(order.status)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Payment</dt>
              <dd className="font-medium text-primary">{formatStatus(order.payment_status)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Fulfillment</dt>
              <dd className="font-medium text-primary">{formatStatus(order.fulfillment_status)}</dd>
            </div>
          </dl>
        </div>
        {(order.status === "pending" ||
          order.status === "pending_payment" ||
          order.status === "requires_action") && (
          <OrderCancelButton
            orderId={order.id}
            orderDisplayId={displayId}
          />
        )}
      </div>

      <section className="mb-8 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
          Status timeline
        </h2>
        <ol
          className="mt-5 grid gap-4 sm:grid-cols-5"
          aria-label={`Order status timeline; current step ${formatStatus(steps[currentIndex])}`}
        >
          {steps.map((step, index) => {
            const isComplete = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <li
                key={step}
                className="rounded-xl border border-outline-variant/20 p-4"
                aria-current={isCurrent ? "step" : undefined}
              >
                <div
                  className={`mb-3 h-3 w-3 rounded-full ${isComplete ? "bg-primary" : "bg-outline-variant/30"}`}
                />
                <p className={`text-sm font-medium ${isComplete ? "text-primary" : "text-on-surface-variant"}`}>
                  {formatStatus(step)}
                </p>
                {isCurrent ? (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Current step
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
            Items
          </h2>
          <ul className="mt-5 divide-y divide-outline-variant/10">
            {(order.items ?? []).map((item, index) => (
              <li key={item.id ?? `${item.title ?? "item"}-${index}`} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-primary">
                      {item.title ?? "Item"}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Qty {item.quantity ?? 0}
                      {item.variant?.sku ? ` · SKU ${item.variant.sku}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm text-on-surface-variant">
                    <p>{formatMoney(item.total, currency)}</p>
                    {item.unit_price != null ? (
                      <p className="mt-1 text-xs">Unit {formatMoney(item.unit_price, currency)}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Summary
            </h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant">Subtotal</dt>
                <dd className="font-medium text-on-surface">
                  {formatMoney(order.subtotal, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant">Shipping</dt>
                <dd className="font-medium text-on-surface">
                  {formatMoney(order.shipping_total, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant">Discount</dt>
                <dd className="font-medium text-on-surface">
                  {formatMoney(order.discount_total, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant">Tax</dt>
                <dd className="font-medium text-on-surface">
                  {formatMoney(order.tax_total, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-3">
                <dt className="font-medium text-primary">Total</dt>
                <dd className="font-headline text-lg font-bold text-primary">
                  {formatMoney(order.total, currency)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Shipping
            </h2>
            {order.shipping_address ? (
              <address className="mt-4 not-italic text-sm leading-relaxed text-on-surface-variant">
                <p className="font-medium text-on-surface">
                  {[
                    order.shipping_address.first_name,
                    order.shipping_address.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Shipping address"}
                </p>
                <p>{order.shipping_address.address_1}</p>
                {order.shipping_address.address_2 ? (
                  <p>{order.shipping_address.address_2}</p>
                ) : null}
                <p>
                  {[
                    order.shipping_address.city,
                    order.shipping_address.province,
                    order.shipping_address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>{order.shipping_address.country_code}</p>
              </address>
            ) : (
              <p className="mt-4 text-sm text-on-surface-variant">
                No shipping address stored on this order.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Tracking
            </h2>
            <div className="mt-4 space-y-4 text-sm text-on-surface-variant">
              {(order.fulfillments ?? []).length > 0 ? (
                (order.fulfillments ?? []).map((fulfillment, index) => {
                  const trackingNumbers = [
                    ...(fulfillment.tracking_numbers ?? []),
                    ...((fulfillment.labels ?? [])
                      .map((label) => label?.tracking_number)
                      .filter((value): value is string => Boolean(value))),
                  ].filter(Boolean);
                  return (
                    <div key={fulfillment.id ?? `fulfillment-${index}`} className="rounded-xl border border-outline-variant/15 p-4">
                      <p className="font-medium text-on-surface">
                        {formatStatus(fulfillment.provider_id)} · {formatStatus(fulfillment.status)}
                      </p>
                      {trackingNumbers.length > 0 ? (
                        <p className="mt-1">
                          Tracking: {trackingNumbers.join(" · ")}
                        </p>
                      ) : (
                        <p className="mt-1">Awaiting tracking number.</p>
                      )}
                      {fulfillment.shipped_at ? (
                        <p className="mt-1 text-xs">
                          Shipped{" "}
                          <time dateTime={fulfillment.shipped_at}>
                            {new Date(fulfillment.shipped_at).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </time>
                        </p>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p>No shipment records yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Actions
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href={`/account/orders/${order.id}/return`}
                className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-on-primary"
              >
                Request return
              </Link>
              <Link
                href="/help"
                className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-primary"
              >
                Contact support
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
