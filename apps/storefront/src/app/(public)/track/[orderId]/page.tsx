import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  resolveOpaqueTrackingCapabilityDetails,
  sanitizeTrustedPublicUrl,
} from "@universal-music-store/sdk";
import { isTrackingCapabilityRevoked } from "@universal-music-store/platform-data/tracking-capability-revocation";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import {
  fetchMedusaTrackByCartId,
  fetchMedusaTrackByOrderId,
  trackFreshness,
  trackingCapabilityScopeMatches,
  type TrackReadResult,
} from "@/lib/medusa-track-fetch";
import { TrackingAutoRefresh } from "@/components/TrackingAutoRefresh";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

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

async function fetchPublicTrack(orderId: string): Promise<TrackReadResult> {
  if (orderId.startsWith("order_")) {
    return fetchMedusaTrackByOrderId(orderId);
  }
  if (orderId.startsWith("cart_")) {
    return fetchMedusaTrackByCartId(orderId);
  }
  return { ok: false, data: null, status: 404 };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: rawOrderId } = await params;
  const encodedId = decodeURIComponent(rawOrderId.trim());
  const capability = encodedId.startsWith("cap_")
    ? resolveOpaqueTrackingCapabilityDetails(encodedId.slice(4))
    : null;
  const orderId = capability?.id ?? encodedId;
  const hasValidToken = capability !== null;

  if (!hasValidToken) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
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
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center bg-primary text-on-primary px-6 py-2.5 rounded font-medium hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  const localAuthDisabled =
    process.env.NODE_ENV !== "production" &&
    (process.env.AUTH_DISABLE === "true" ||
      process.env.NEXT_PUBLIC_AUTH_DISABLE === "true");
  const capabilityClient = localAuthDisabled
    ? null
    : createStorefrontServiceSupabase();
  if (!capabilityClient && !localAuthDisabled) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          Order tracking is not available here right now. Please contact
          support.
        </p>
        <Link href="/track" className="text-primary underline">
          Back to track order
        </Link>
      </main>
    );
  }
  const revocation = capabilityClient
    ? await isTrackingCapabilityRevoked(capabilityClient, encodedId.slice(4))
    : false;
  if (revocation === null) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          Order tracking is not available here right now. Please contact
          support.
        </p>
        <Link href="/track" className="text-primary underline">
          Back to track order
        </Link>
      </main>
    );
  }
  if (revocation) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking link revoked
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          This tracking link is no longer valid. Contact support for a new link.
        </p>
        <Link href="/contact?topic=tracking" className="text-primary underline">
          Contact support
        </Link>
      </main>
    );
  }

  const { ok, data, status, correlationId } = await fetchPublicTrack(orderId);

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
        <Link href="/contact?topic=tracking" className="text-primary underline">
          Contact support
        </Link>
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
        <Link href="/track" className="text-primary underline">
          Back to track order
        </Link>
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
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center bg-primary text-on-primary px-6 py-2.5 rounded font-medium hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  const { order, shipments } = data;
  // Never render the decrypted commerce identifier when the display reference is absent.
  const displayRef = order.order_number ?? "your order";
  const freshness = trackFreshness(order.updated_at);

  const statusSteps = [
    "pending_payment",
    "paid",
    "ready_to_ship",
    "shipped",
    "delivered",
  ];
  const currentIndex =
    statusSteps.indexOf(String(order.status ?? "")) >= 0
      ? statusSteps.indexOf(String(order.status))
      : 0;

  return (
    <main className="storefront-page-shell max-w-2xl">
      <Link
        href="/account"
        className="text-sm text-on-surface-variant hover:text-primary mb-8 inline-block"
      >
        Back to account
      </Link>

      <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
        Order {displayRef}
      </h1>
      <p
        className="font-body text-on-surface-variant mb-12"
        role="status"
        aria-live="polite"
      >
        Status: {(order.status as string)?.replace(/_/g, " ") ?? "Unknown"}
        {order.updated_at ? (
          <>
            {" "}
            · Updated{" "}
            <time dateTime={order.updated_at}>
              {new Date(order.updated_at).toLocaleString("en-PH")}
            </time>
          </>
        ) : (
          ""
        )}
        {freshness === "stale" ? " · Status may be out of date" : ""}
      </p>
      <TrackingAutoRefresh />

      {String(order.status) === "pending_payment" &&
        orderId.startsWith("cart_") && (
          <div className="mb-8 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4">
            <p className="text-sm text-on-surface-variant mb-3">
              Payment not completed yet. Open checkout on this device using the
              same cart (for example after switching from another browser).
            </p>
            <Link
              href={`/checkout?resume=${encodeURIComponent(orderId)}`}
              className="inline-flex min-h-11 items-center justify-center bg-primary text-on-primary px-5 py-2.5 rounded font-medium text-sm hover:opacity-90"
            >
              Continue checkout
            </Link>
          </div>
        )}

      <div className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8 mb-8">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
          Progress
        </h2>
        <ol
          className="space-y-6"
          aria-label="Order progress"
          aria-live="polite"
        >
          {statusSteps.map((step, i) => {
            const isComplete = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <li
                key={step}
                className="flex items-center gap-4"
                aria-current={isCurrent ? "step" : undefined}
              >
                <div
                  className={`w-4 h-4 rounded-full flex-shrink-0 ${isComplete ? "bg-primary" : "bg-surface-container-high"}`}
                />
                <div>
                  <p
                    className={`font-medium ${isComplete ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {step.replace(/_/g, " ")}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Current step
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {shipments.length > 0 && (
        <div className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
            Shipments
          </h2>
          <div className="space-y-6">
            {shipments.map((s) => (
              <article
                key={s.id}
                className="border-b border-surface-container-high pb-6 last:border-0 last:pb-0"
              >
                {s.tracking_number ? (
                  sanitizeTrustedPublicUrl(s.tracking_url) ? (
                    <a
                      href={
                        sanitizeTrustedPublicUrl(s.tracking_url) ?? undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center font-medium text-primary underline hover:opacity-80"
                    >
                      {s.tracking_number}
                    </a>
                  ) : (
                    <p
                      className="font-medium text-primary"
                      aria-label={`Tracking number ${s.tracking_number}`}
                    >
                      {s.tracking_number}
                    </p>
                  )
                ) : (
                  <p className="font-medium text-on-surface-variant">
                    Awaiting tracking
                  </p>
                )}
                <p className="text-sm text-on-surface-variant mt-1">
                  {s.carrier_slug
                    ? s.carrier_slug.replace(/-/g, " ").toUpperCase()
                    : "Carrier"}{" "}
                  · {s.status?.replace(/_/g, " ") ?? "Pending"}
                </p>
                {s.updated_at && (
                  <p
                    className="text-xs text-on-surface-variant mt-1"
                    role="status"
                  >
                    Updated{" "}
                    <time dateTime={s.updated_at}>
                      {new Date(s.updated_at).toLocaleString("en-PH")}
                    </time>
                    {s.source ? ` · Source: ${s.source}` : ""}
                    {trackFreshness(s.updated_at) === "stale"
                      ? " · Status may be out of date"
                      : ""}
                  </p>
                )}
                {s.expected_delivery && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Estimated delivery:{" "}
                    <time
                      dateTime={s.expected_delivery}
                      className="font-medium text-primary"
                    >
                      {new Date(s.expected_delivery).toLocaleDateString(
                        "en-PH",
                        {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </time>
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {shipments.length === 0 && order.status !== "pending_payment" && (
        <p className="text-on-surface-variant text-sm" role="status">
          No shipment records yet. Tracking will appear when your order ships.
        </p>
      )}
    </main>
  );
}
