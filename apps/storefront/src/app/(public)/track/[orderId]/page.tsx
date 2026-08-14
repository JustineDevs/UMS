import type { Metadata } from "next";
import Link from "next/link";
import { sanitizeTrustedPublicUrl, verifyTrackingToken } from "@universal-music-store/sdk";
import {
  fetchMedusaTrackByCartId,
  fetchMedusaTrackByOrderId,
  type TrackPayload,
} from "@/lib/medusa-track-fetch";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildPageMetadata({
  title: "Track order",
  description: "View the latest public shipment updates for a specific order.",
  path: "/track",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

async function fetchPublicTrack(orderId: string): Promise<{
  ok: boolean;
  data: TrackPayload | null;
  status: number;
}> {
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
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderId: rawOrderId } = await params;
  const { t } = await searchParams;
  const orderId = decodeURIComponent(rawOrderId.trim());
  const token = t?.trim();

  const secretSet = Boolean(process.env.TRACKING_HMAC_SECRET?.trim());
  const hasValidToken =
    Boolean(token) &&
    (orderId.startsWith("order_") || orderId.startsWith("cart_")) &&
    verifyTrackingToken(orderId, token!);

  const legacyNoTokenOk =
    !secretSet &&
    process.env.NODE_ENV !== "production" &&
    (orderId.startsWith("order_") || orderId.startsWith("cart_"));

  if (!hasValidToken && !legacyNoTokenOk) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking link incomplete
        </h1>
        <p className="font-body text-on-surface-variant mb-6">
          Open the full link from your order confirmation email, or enter your
          order number and tracking code on the{" "}
          <Link href="/track" className="text-primary underline">
            track order
          </Link>{" "}
          page.
        </p>
        <Link
          href="/shop"
          className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded font-medium hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  const { ok, data, status } = await fetchPublicTrack(orderId);

  if (status === 503) {
    return (
      <main className="storefront-page-shell max-w-2xl text-center">
        <h1 className="font-headline text-2xl font-bold text-primary mb-4">
          Tracking unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6">
          Order tracking is not available here right now. Please contact support.
        </p>
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
        <p className="font-body text-on-surface-variant mb-6">
          We could not find a matching order. Check your order number, tracking
          code, and link from your confirmation email.
        </p>
        <Link
          href="/shop"
          className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded font-medium hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  const { order, shipments } = data;
  const displayRef = order.order_number ?? orderId;

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
      <p className="font-body text-on-surface-variant mb-12">
        Status: {(order.status as string)?.replace(/_/g, " ") ?? "Unknown"}
      </p>

      {String(order.status) === "pending_payment" &&
        orderId.startsWith("cart_") && (
          <div className="mb-8 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4">
            <p className="text-sm text-on-surface-variant mb-3">
              Payment not completed yet. Open checkout on this device using the
              same cart (for example after switching from another browser).
            </p>
            <Link
              href={`/checkout?resume=${encodeURIComponent(orderId)}`}
              className="inline-flex items-center justify-center bg-primary text-on-primary px-5 py-2.5 rounded font-medium text-sm hover:opacity-90"
            >
              Continue checkout
            </Link>
          </div>
        )}

      <div className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8 mb-8">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
          Progress
        </h2>
        <div className="space-y-6">
          {statusSteps.map((step, i) => {
            const isComplete = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={step} className="flex items-center gap-4">
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
              </div>
            );
          })}
        </div>
      </div>

      {shipments.length > 0 && (
        <div className="bg-surface-container-lowest rounded shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-8">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
            Shipments
          </h2>
          <div className="space-y-6">
            {shipments.map((s) => (
              <div
                key={s.id}
                className="border-b border-surface-container-high pb-6 last:border-0 last:pb-0"
              >
                {s.tracking_number ? (
                  sanitizeTrustedPublicUrl(s.tracking_url) ? (
                    <a
                      href={sanitizeTrustedPublicUrl(s.tracking_url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline hover:opacity-80"
                    >
                      {s.tracking_number}
                    </a>
                  ) : (
                    <p className="font-medium text-primary">{s.tracking_number}</p>
                  )
                ) : (
                  <p className="font-medium text-on-surface-variant">Awaiting tracking</p>
                )}
                <p className="text-sm text-on-surface-variant mt-1">
                  {s.carrier_slug ? s.carrier_slug.replace(/-/g, " ").toUpperCase() : "Carrier"} ·{" "}
                  {s.status?.replace(/_/g, " ") ?? "Pending"}
                </p>
                {s.expected_delivery && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Estimated delivery:{" "}
                    <time dateTime={s.expected_delivery} className="font-medium text-primary">
                      {new Date(s.expected_delivery).toLocaleDateString("en-PH", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {shipments.length === 0 && order.status !== "pending_payment" && (
        <p className="text-on-surface-variant text-sm">
          No shipment records yet. Tracking will appear when your order ships.
        </p>
      )}
    </main>
  );
}
