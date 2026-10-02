import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderCancelButton } from "@/components/OrderCancelButton";
import { getStorefrontSession } from "@/lib/auth";
import { fetchWorkerCustomerOrderDetail } from "@/lib/account-orders";

export const metadata: Metadata = {
  title: "Order details",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type OrderItemRow = {
  id?: string;
  title?: string | null;
  thumbnail?: string | null;
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
  payment_status?: string | null;
  fulfillment_status?: string | null;
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

function formatMoney(
  amount: number | undefined,
  currency = "PHP",
  zeroLabel = "Pending confirmation",
) {
  if (amount == null || !Number.isFinite(amount)) return "Unavailable";
  if (amount === 0) return zeroLabel;
  return `${currency} ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatOrderReference(orderId: string, displayId?: string | number) {
  if (displayId != null && String(displayId).trim()) return String(displayId);
  const suffix = orderId.replace(/^order_/, "").slice(-6).toUpperCase();
  return `UMS-${suffix}`;
}

function isReturnEligible(
  status?: string,
  fulfillmentStatus?: string | null,
  fulfillmentCount = 0,
) {
  if (fulfillmentCount === 0) return false;
  return (
    ["delivered", "completed"].includes(String(status ?? "").toLowerCase()) ||
    ["delivered", "completed"].includes(
      String(fulfillmentStatus ?? "").toLowerCase(),
    )
  );
}

function formatStatus(value: string | null | undefined) {
  return (value ?? "unknown").replace(/_/g, " ");
}

function orderStatusSteps(status: string | undefined) {
  const steps = [
    "pending_payment",
    "paid",
    "ready_to_ship",
    "shipped",
    "delivered",
  ];
  const currentIndex = steps.indexOf(String(status ?? ""));
  return { steps, currentIndex: currentIndex >= 0 ? currentIndex : 0 };
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const [{ orderId }, session] = await Promise.all([params, getStorefrontSession()]);
  const userEmail = session?.user?.email?.trim().toLowerCase();
  if (!session || !userEmail) {
    redirect(
      `/login?callbackUrl=/account/orders/${encodeURIComponent(orderId)}`,
    );
  }

  if (!orderId?.startsWith("order_")) {
    notFound();
  }

  const workerDetail = await fetchWorkerCustomerOrderDetail(orderId);
  if (!workerDetail || workerDetail.error !== null || !workerDetail.order)
    notFound();
  const order: OrderRow = workerDetail.order;

  if (!order?.id) notFound();

  const currency = String(order.currency_code ?? "PHP").toUpperCase();
  const displayId = formatOrderReference(order.id, order.display_id);
  const { steps, currentIndex } = orderStatusSteps(order.status);
  const fulfillmentCount = order.fulfillments?.length ?? 0;

  return (
    <main className="storefront-page-shell storefront-content-wide max-w-6xl">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-1 text-xs text-on-surface-variant"
      >
        <Link href="/account/profile" className="hover:text-primary">
          Account
        </Link>
        <span aria-hidden="true" className="select-none">
          /
        </span>
        <span className="text-primary font-medium" aria-current="page">
          Order {displayId}
        </span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary">
            Order #{displayId}
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {order.created_at ? (
              <>
                Placed{" "}
                <time dateTime={order.created_at}>
                  {new Date(order.created_at).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                {" · "}
              </>
            ) : null}
            Review your items, payment, and delivery details.
          </p>
          <dl
            className="mt-3 grid gap-x-5 gap-y-2 text-sm text-on-surface-variant sm:grid-cols-3"
            aria-label="Order state summary"
          >
            <div>
              <dt className="text-xs uppercase tracking-wide">Order status</dt>
              <dd className="font-medium text-primary">
                {formatStatus(order.status)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Payment</dt>
              <dd className="font-medium text-primary">
                {formatStatus(order.payment_status)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Fulfillment</dt>
              <dd className="font-medium text-primary">
                {formatStatus(order.fulfillment_status)}
              </dd>
            </div>
          </dl>
        </div>
        {(order.status === "pending" ||
          order.status === "pending_payment" ||
          order.status === "requires_action") && (
          <OrderCancelButton orderId={order.id} orderDisplayId={displayId} />
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
                <p
                  className={`text-sm font-medium ${isComplete ? "text-primary" : "text-on-surface-variant"}`}
                >
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
            {(order.items ?? []).map((item) => (
              <li
                key={item.id ?? JSON.stringify(item)}
                className="py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-container-low">
                      {item.thumbnail ? (
                        <div
                          role="img"
                          aria-label={item.title ?? "Order item"}
                          className="size-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${item.thumbnail})` }}
                        />
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                          Item
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-primary">
                        {item.title ?? "Item"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span
                          className={`rounded-full px-2.5 py-1 font-semibold ${
                            (item.quantity ?? 0) > 1
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-low text-primary"
                          }`}
                        >
                          Quantity {item.quantity ?? 0}
                        </span>
                        {item.variant?.sku ? (
                          <span>SKU {item.variant.sku}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-on-surface-variant">
                    <p>
                      {formatMoney(item.total, currency, "Price pending")}
                    </p>
                    {item.unit_price != null ? (
                      <p className="mt-1 text-xs">
                        Unit{" "}
                        {formatMoney(item.unit_price, currency, "Price pending")}
                      </p>
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
                  {order.shipping_total === 0
                    ? "Free"
                    : formatMoney(order.shipping_total, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-on-surface-variant">Discount</dt>
                <dd className="font-medium text-on-surface">
                  {order.discount_total === 0
                    ? "None"
                    : formatMoney(order.discount_total, currency)}
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
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-medium">
                  Shipping details are unavailable.
                </p>
                <p className="mt-1 leading-6">
                  Contact support if you need to confirm the delivery destination
                  for this order.
                </p>
                <Link
                  href="/help"
                  className="mt-3 inline-flex font-semibold underline underline-offset-2"
                >
                  Contact support
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Tracking
            </h2>
            <div className="mt-4 space-y-4 text-sm text-on-surface-variant">
              {(order.fulfillments ?? []).length > 0 ? (
                (order.fulfillments ?? []).map((fulfillment) => {
                  const trackingNumbers = [
                    ...(fulfillment.tracking_numbers ?? []),
                    ...(fulfillment.labels ?? [])
                      .map((label) => label?.tracking_number)
                      .filter((value): value is string => Boolean(value)),
                  ].filter(Boolean);
                  return (
                    <div
                      key={fulfillment.id ?? JSON.stringify(fulfillment)}
                      className="rounded-xl border border-outline-variant/15 p-4"
                    >
                      <p className="font-medium text-on-surface">
                        {formatStatus(fulfillment.provider_id)} ·{" "}
                        {formatStatus(fulfillment.status)}
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
                            {new Date(
                              fulfillment.shipped_at,
                            ).toLocaleDateString("en-PH", {
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
                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-4">
                  <p className="font-medium text-on-surface">
                    Tracking starts after payment confirmation.
                  </p>
                  <p className="mt-1 leading-6">
                    We’ll add carrier details here when the order is ready to
                    ship.
                  </p>
                  <Link
                    href={`/track/${order.id}`}
                    className="mt-3 inline-flex font-semibold text-primary underline underline-offset-2"
                  >
                    View live order status
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/70 p-6">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
              Actions
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {isReturnEligible(
                order.status,
                order.fulfillment_status,
                fulfillmentCount,
              ) ? (
                <Link
                  href={`/account/orders/${order.id}/return`}
                  className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-on-primary"
                >
                  Request return
                </Link>
              ) : null}
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
