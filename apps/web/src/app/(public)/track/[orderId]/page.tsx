import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  resolveOpaqueTrackingCapabilityDetails,
  type ResolvedTrackingCapability,
} from "@universal-music-store/sdk";
import {
  fetchWorkerTrackByToken,
  trackFreshness,
  trackingCapabilityScopeMatches,
  trackReadFailure,
  type TrackReadResult,
} from "@/lib/medusa-track-fetch";
import { buildCartResumeHref } from "@/lib/cart-session-boundary";
import { decodeTrackingPathSegment } from "@/lib/tracking-link-resolve";
import { TrackingAutoRefresh } from "@/components/TrackingAutoRefresh";
import { PrintReceiptButton } from "@/components/PrintReceiptButton";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import {
  StorefrontCard,
  StorefrontLinkButton,
  StorefrontPageHeader,
  StorefrontStatus,
} from "@/components/storefront/StorefrontPagePrimitives";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = buildPageMetadata({
  title: "Track order",
  description: "View the latest public shipment updates for a specific order.",
  path: "/track",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
  referrer: "no-referrer",
});

const STATUS_STEPS = [
  "pending_payment",
  "paid",
  "ready_to_ship",
  "shipped",
  "delivered",
];

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Payment pending",
  paid: "Paid",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
};

function formatMoney(value: number | undefined, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatStatus(value: string | undefined) {
  return (
    STATUS_LABELS[value ?? ""] ?? value?.replace(/_/g, " ") ?? "Order update"
  );
}

async function fetchPublicTrack(
  capability: ResolvedTrackingCapability,
  encodedCapability: string,
): Promise<TrackReadResult> {
  if (capability.id.startsWith("order_")) {
    return fetchWorkerTrackByToken(encodedCapability);
  }
  // Cart capabilities do not identify a completed order. Do not fall back to
  // a second commerce runtime for a public tracking read.
  if (capability.id.startsWith("cart_")) return trackReadFailure(503);
  return trackReadFailure(404);
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: rawOrderId } = await params;
  const encodedId = decodeTrackingPathSegment(rawOrderId) ?? "";
  const capability = encodedId.startsWith("cap_")
    ? resolveOpaqueTrackingCapabilityDetails(encodedId.slice(4))
    : null;
  const orderId = capability?.id ?? encodedId;
  const hasValidToken = capability !== null;

  if (!hasValidToken) {
    return (
      <main className="storefront-page-shell max-w-3xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking link incomplete
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          Open the full secure link from your order confirmation email on the{" "}
          <Link href="/track" className="text-primary underline">
            track order
          </Link>{" "}
          tracking page.
        </p>
        <p className="font-body text-sm text-on-surface-variant mb-6">
          If the link is missing or expired, contact{" "}
          <Link
            href="/contact?topic=tracking"
            className="text-primary underline"
          >
            customer support
          </Link>{" "}
          for a new tracking link.
        </p>
        <StorefrontLinkButton href="/shop" variant="primary">
          Continue shopping
        </StorefrontLinkButton>
      </main>
    );
  }

  const { ok, data, status, correlationId } = await fetchPublicTrack(
    capability,
    encodedId.slice(4),
  );

  if (
    data &&
    !trackingCapabilityScopeMatches(
      capability,
      data.capabilityScope,
      process.env.DEFAULT_ORGANIZATION_ID,
    )
  ) {
    notFound();
  }

  if (status === 404) notFound();

  if (status === 401 || status === 403 || status === 409) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          This secure tracking link cannot be used for this request. Contact
          support if you need a new link.
        </p>
        {correlationId ? (
          <p className="font-body text-xs text-on-surface-variant mb-6">
            Support reference: {correlationId}
          </p>
        ) : null}
        <StorefrontLinkButton href="/contact?topic=tracking">
          Contact support
        </StorefrontLinkButton>
      </main>
    );
  }

  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking temporarily unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          We could not retrieve the latest tracking update. Please try again
          shortly.
        </p>
        {correlationId ? (
          <p className="font-body text-xs text-on-surface-variant mb-6">
            Support reference: {correlationId}
          </p>
        ) : null}
        <StorefrontLinkButton href="/track">
          Back to track order
        </StorefrontLinkButton>
      </main>
    );
  }

  if (!ok || !data?.order) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Order not found
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          We could not find a matching order. Check your order number, tracking
          code, and link from your confirmation email.
        </p>
        <StorefrontLinkButton href="/shop" variant="primary">
          Continue shopping
        </StorefrontLinkButton>
      </main>
    );
  }

  const { order, shipments, orderSummary } = data;
  const cartResumeHref = orderId.startsWith("cart_")
    ? buildCartResumeHref(orderId)
    : null;
  // Never render the decrypted commerce identifier when the display reference is absent.
  const displayRef = order.order_number ?? "your order";
  const displayNumber = displayRef.replace(/^order\s*#?/i, "").trim() || displayRef;
  const freshness = trackFreshness(order.updated_at);

  const currentIndex =
    STATUS_STEPS.indexOf(String(order.status ?? "")) >= 0
      ? STATUS_STEPS.indexOf(String(order.status))
      : 0;

  const summaryItems = orderSummary?.items ?? [];
  const address = orderSummary?.shipping_address;
  const statusValue = String(order.status ?? "");
  const statusLabel = formatStatus(statusValue);

  return (
    <main className="storefront-page-shell storefront-content-wide max-w-[1440px] bg-surface-container-low">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <StorefrontPageHeader
          eyebrow={
            <Link
              href="/account/profile"
              className="text-sm font-medium normal-case tracking-normal text-on-surface-variant hover:text-primary"
            >
              Back to account
            </Link>
          }
          title={`Order #${displayNumber}`}
          description={
            <>
              <p className="font-semibold text-primary">
                Your order is saved and we’re keeping you updated.
              </p>
              <p role="status" aria-live="polite">
                {statusLabel}
                {order.updated_at ? (
                  <>
                    {" "}
                    · Updated{" "}
                    <time dateTime={order.updated_at}>
                      {new Date(order.updated_at).toLocaleString("en-PH")}
                    </time>
                  </>
                ) : null}
                {freshness === "stale" ? " · Status may be out of date" : ""}
              </p>
              <TrackingAutoRefresh />
            </>
          }
          aside={
            <StorefrontLinkButton href="/shop">
              Continue shopping
            </StorefrontLinkButton>
          }
        />

        {statusValue === "pending_payment" ? (
          <StorefrontCard
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div>
              <h2 className="font-headline text-lg font-bold text-primary">
                We’re still confirming your payment
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">
                Your order is saved. The payment provider has not sent a final
                confirmation yet, so we’ll keep checking securely.
              </p>
            </div>
            {cartResumeHref ? (
              <StorefrontLinkButton href={cartResumeHref} variant="primary">
                Continue checkout
              </StorefrontLinkButton>
            ) : null}
          </StorefrontCard>
        ) : null}

        <StorefrontCard aria-labelledby="progress-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="progress-heading"
                className="font-headline text-xl font-bold text-primary"
              >
                Order progress
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Your order moves through these stages as it is processed.
              </p>
            </div>
            <StorefrontStatus
              variant={
                statusValue === "pending_payment" ? "warning" : "neutral"
              }
            >
              {statusLabel}
            </StorefrontStatus>
          </div>
          <ol
            className="mt-8 grid gap-5 sm:grid-cols-5 sm:gap-0"
            aria-label="Order progress"
            aria-live="polite"
          >
            {STATUS_STEPS.map((step, i) => {
              const isComplete = i <= currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <li
                  key={step}
                  className="relative flex items-start gap-3 sm:block sm:text-center"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {i < STATUS_STEPS.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={`absolute left-3 top-3 hidden h-px w-[calc(100% - 1.5rem)] sm:block ${i < currentIndex ? "bg-primary" : "bg-outline-variant/50"}`}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface-container-lowest sm:mx-auto ${isComplete ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant"}`}
                    aria-hidden="true"
                  >
                    {isComplete && i < currentIndex ? "✓" : i + 1}
                  </span>
                  <span
                    className={`mt-0.5 block text-sm font-semibold sm:mt-3 ${isComplete ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {STATUS_LABELS[step]}
                  </span>
                  {isCurrent ? (
                    <span className="mt-1 block text-xs text-on-surface-variant sm:px-2">
                      Current step
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </StorefrontCard>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)]">
          <StorefrontCard aria-labelledby="summary-heading">
            <div className="flex items-end justify-between gap-4 border-b border-outline-variant/40 pb-5">
              <div>
                <h2
                  id="summary-heading"
                  className="font-headline text-xl font-bold text-primary"
                >
                  Order summary
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  The items included in this order.
                </p>
              </div>
              <p className="text-right text-sm font-semibold text-primary">
                {summaryItems.length} item{summaryItems.length === 1 ? "" : "s"}
              </p>
            </div>
            {summaryItems.length ? (
              <ul
                className="divide-y divide-outline-variant/30"
                aria-label="Items in this order"
              >
                {summaryItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-4 py-5 first:pt-6 last:pb-2"
                  >
                    <div
                      className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low text-primary"
                      role={item.thumbnail ? "img" : undefined}
                      aria-label={item.thumbnail ? item.title || "Order item" : undefined}
                      style={item.thumbnail ? { backgroundImage: `url(${item.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                    >
                      {!item.thumbnail ? <span className="material-symbols-outlined" aria-hidden="true">music_note</span> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary">
                        {item.title || "Music item"}
                      </p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Qty {item.quantity ?? 0}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                      {formatMoney(
                        (item.unit_price ?? 0) * (item.quantity ?? 0),
                        orderSummary?.currency,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-sm text-on-surface-variant">
                Item details will appear here once the order summary is
                available.
              </p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-outline-variant/40 pt-5">
              <span className="text-sm text-on-surface-variant">Total</span>
              <strong className="text-xl tabular-nums text-primary">
                {formatMoney(orderSummary?.total, orderSummary?.currency)}
              </strong>
            </div>
          </StorefrontCard>

          <StorefrontCard aria-labelledby="delivery-heading">
            <h2
              id="delivery-heading"
              className="font-headline text-xl font-bold text-primary"
            >
              Delivery details
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Your delivery information will update as the order moves forward.
            </p>
            <dl className="mt-7 flex flex-col gap-5 text-sm">
              <div>
                <dt className="font-semibold text-primary">
                  Shipping destination
                </dt>
                <dd className="mt-1 leading-6 text-on-surface-variant">
                  {address?.city || address?.province
                    ? [address.city, address.province]
                        .filter(Boolean)
                        .join(", ")
                    : "Address details are being prepared."}
                  {address?.postal_code ? ` ${address.postal_code}` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-primary">Shipment status</dt>
                <dd className="mt-1 text-on-surface-variant">
                  {shipments.length
                    ? `${shipments.length} shipment${shipments.length === 1 ? "" : "s"} created`
                    : statusValue === "pending_payment"
                      ? "Waiting for payment confirmation"
                      : "Preparing your shipment"}
                </dd>
              </div>
            </dl>
            {shipments.length > 0 ? (
              <div className="mt-7 border-t border-outline-variant/40 pt-5">
                <h3 className="text-sm font-semibold text-primary">Tracking</h3>
                <div className="mt-3 flex flex-col gap-4">
                  {shipments.map((s) => (
                    <article key={s.id} className="text-sm">
                      {s.tracking_number ? (
                        <p className="font-semibold text-primary">
                          {s.tracking_number}
                        </p>
                      ) : (
                        <p className="font-medium text-on-surface-variant">
                          Awaiting tracking number
                        </p>
                      )}
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {s.carrier_slug
                          ? s.carrier_slug.replace(/-/g, " ").toUpperCase()
                          : "Carrier"}{" "}
                        · {s.status_quality === "unknown"
                          ? "Status syncing"
                          : s.status?.replace(/_/g, " ") ?? "Pending"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                        {s.status_quality === "unknown" ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            Carrier status is being reconciled
                          </span>
                        ) : null}
                        {s.source ? <span>Source: {s.source}</span> : null}
                        {s.expected_delivery ? (
                          <span>
                            Expected by <time dateTime={s.expected_delivery}>{s.expected_delivery}</time>
                          </span>
                        ) : null}
                        {trackFreshness(s.updated_at) === "stale" ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            Update may be out of date
                          </span>
                        ) : null}
                      </div>
                      {s.tracking_url ? (
                        <a
                          href={s.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:opacity-80"
                        >
                          Track live shipment
                          <span className="material-symbols-outlined ml-1 text-base" aria-hidden="true">open_in_new</span>
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </StorefrontCard>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/contact?topic=tracking"
            className="text-sm font-semibold text-primary underline underline-offset-4 hover:opacity-80"
          >
            Need help with this order?
          </Link>
          <PrintReceiptButton />
        </div>
      </div>
    </main>
  );
}
