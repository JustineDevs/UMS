import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildTrackingUrl,
  DEFAULT_PUBLIC_SITE_ORIGIN,
  resolveOpaqueTrackingCapabilityDetails,
  sanitizeTrustedPublicUrl,
} from "@universal-music-store/sdk";
import {
  fetchMedusaTrackByOrderId,
  fetchMedusaTrackByCartId,
  trackingCapabilityScopeMatches,
  type ConfirmationOrder,
  type TrackReadResult,
  type TrackPayload,
} from "@/lib/medusa-track-fetch";
import { SITE_NAME, buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = buildPageMetadata({
  title: `Order Confirmed | ${SITE_NAME}`,
  description: "Order confirmation and delivery summary.",
  path: "/order-confirmation",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
  referrer: "no-referrer",
});

type OrderLine = {
  id: string;
  title?: string;
  quantity?: number;
  unit_price?: number;
  thumbnail?: string | null;
};

type ConfirmOrder = ConfirmationOrder & {
  items?: OrderLine[];
  shipping_total?: number;
  subtotal?: number;
  tax_total?: number;
  total?: number;
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  } | null;
};

type ConfirmPayload = {
  order: ConfirmOrder;
  shipments: TrackPayload["shipments"];
  capabilityScope?: TrackPayload["capabilityScope"];
};

function confirmationPayload(data: TrackPayload): ConfirmPayload {
  const source = data.confirmationOrder ?? data.order;
  const order = Object.fromEntries(
    Object.entries(source).filter(([key]) => key !== "id"),
  ) as ConfirmOrder;
  return {
    order,
    shipments: data.shipments,
    capabilityScope: data.capabilityScope,
  };
}

async function fetchOrderData(
  orderId: string,
): Promise<Omit<TrackReadResult, "data"> & { data: ConfirmPayload | null }> {
  const trimmed = orderId.trim();
  if (trimmed.startsWith("order_")) {
    const r = await fetchMedusaTrackByOrderId(trimmed, {
      includePrivate: true,
    });
    return {
      ok: r.ok,
      status: r.status,
      ...(r.correlationId ? { correlationId: r.correlationId } : {}),
      data: r.data ? confirmationPayload(r.data) : null,
    };
  }
  if (trimmed.startsWith("cart_")) {
    const r = await fetchMedusaTrackByCartId(trimmed, { includePrivate: true });
    return {
      ok: r.ok,
      status: r.status,
      ...(r.correlationId ? { correlationId: r.correlationId } : {}),
      data: r.data ? confirmationPayload(r.data) : null,
    };
  }
  return { ok: false, data: null, status: 404 };
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: rawId } = await params;
  const encodedId = decodeURIComponent(rawId.trim());
  const capability = encodedId.startsWith("cap_")
    ? resolveOpaqueTrackingCapabilityDetails(
        encodedId.slice(4),
        Date.now(),
        "confirmation",
      )
    : null;
  const orderId = capability?.id ?? encodedId;
  const signedAccess = capability !== null;
  if (!signedAccess) {
    return (
      <main className="storefront-page-shell max-w-2xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-4">
          Order confirmation unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6">
          Open the signed confirmation link from your order email to view this
          order.
        </p>
        <Link
          href="/shop"
          className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }
  const { ok, data, status, correlationId } = await fetchOrderData(orderId);

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
      <main className="storefront-page-shell max-w-2xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-4">
          Confirmation unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          This confirmation link cannot be used for this request. Contact
          support if you need a new link.
        </p>
        {correlationId ? (
          <p className="font-body text-xs text-on-surface-variant mb-6">
            Support reference: {correlationId}
          </p>
        ) : null}
        <Link
          href="/shop"
          className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
    return (
      <main className="storefront-page-shell max-w-2xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-4">
          Confirmation temporarily unavailable
        </h1>
        <p className="font-body text-on-surface-variant mb-6" role="alert">
          Your order may still have been received. Try again shortly or contact
          support.
        </p>
        {correlationId ? (
          <p className="font-body text-xs text-on-surface-variant mb-6">
            Support reference: {correlationId}
          </p>
        ) : null}
        <Link
          href="/shop"
          className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  if (!ok || !data?.order) {
    return (
      <main className="storefront-page-shell max-w-2xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-4">
          Order not found
        </h1>
        <p className="font-body text-on-surface-variant mb-6">
          We could not find this order. Check your email for confirmation
          details.
        </p>
        <Link
          href="/shop"
          className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Continue shopping
        </Link>
      </main>
    );
  }

  const { order, shipments } = data;
  const safeOrder = { ...order };
  delete safeOrder.id;
  const displayId = safeOrder.display_id ?? "your order";
  const trackingUrl =
    buildTrackingUrl(
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? DEFAULT_PUBLIC_SITE_ORIGIN,
      orderId,
      {
        customerEmail:
          typeof safeOrder.email === "string" ? safeOrder.email : undefined,
        storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
      },
    ) ?? "/track";
  const items: OrderLine[] = Array.isArray(safeOrder.items)
    ? safeOrder.items
    : [];
  const total =
    typeof safeOrder.total === "number" ? safeOrder.total / 100 : null;
  const addr = safeOrder.shipping_address ?? null;
  const addrLine = addr
    ? [
        addr.address_1,
        addr.address_2,
        addr.city,
        addr.province,
        addr.postal_code,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <main className="storefront-page-shell max-w-2xl">
      <div className="mb-8 rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-7 w-7 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tighter text-primary mb-2">
          Order Confirmed
        </h1>
        <p className="font-body text-on-surface-variant">
          Thank you for your order. We will send updates to{" "}
          {safeOrder.email ? <strong>{safeOrder.email}</strong> : "your email"}.
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Order #{displayId}
        </p>
      </div>

      {items.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-4 font-headline text-lg font-bold text-primary">
            Items ordered
          </h2>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4">
                {item.thumbnail && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-surface-container-high">
                    <Image
                      src={item.thumbnail}
                      alt={item.title ?? "Product"}
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized={shouldUnoptimizeImage(item.thumbnail)}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary truncate">
                    {item.title}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    Qty: {item.quantity ?? 1}
                  </p>
                </div>
                {typeof item.unit_price === "number" && (
                  <p className="shrink-0 text-sm font-medium text-primary">
                    PHP{" "}
                    {(
                      (item.unit_price * (item.quantity ?? 1)) /
                      100
                    ).toLocaleString("en-PH")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(total !== null || addrLine || shipments.length > 0) && (
        <section className="mb-6 space-y-2 rounded-lg border border-outline-variant/20 p-4 text-sm">
          {addrLine && (
            <div>
              <span className="font-medium text-primary">Delivering to: </span>
              <span className="text-on-surface-variant">{addrLine}</span>
            </div>
          )}
          {total !== null && (
            <div>
              <span className="font-medium text-primary">Total: </span>
              <span className="text-on-surface-variant">
                PHP {total.toLocaleString("en-PH")}
              </span>
              <span className="ml-1 text-xs text-on-surface-variant">
                VAT incl.
              </span>
            </div>
          )}
          <div>
            <span className="font-medium text-primary">
              Estimated delivery:{" "}
            </span>
            <span className="text-on-surface-variant">
              {shipments.find((s) => s.expected_delivery)
                ? "Carrier ETA available in tracking"
                : "3–7 business days"}
            </span>
          </div>
        </section>
      )}

      {shipments.length > 0 && (
        <section className="mb-6 rounded-lg border border-outline-variant/20 p-4 text-sm">
          <h2 className="mb-3 font-headline text-sm font-bold uppercase tracking-widest text-primary">
            Shipment status
          </h2>
          <div className="space-y-3">
            {shipments.map((s) => (
              <div
                key={s.id}
                className="rounded border border-outline-variant/15 bg-surface-container-lowest p-3"
              >
                <p className="font-medium text-primary">
                  {s.tracking_number ?? "Awaiting tracking number"}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {(s.carrier_slug ?? "carrier")
                    .replace(/-/g, " ")
                    .toUpperCase()}{" "}
                  · {(s.status ?? "pending").replace(/_/g, " ")}
                </p>
                {sanitizeTrustedPublicUrl(s.tracking_url) ? (
                  <a
                    href={sanitizeTrustedPublicUrl(s.tracking_url) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-primary underline"
                  >
                    Open public tracking
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={trackingUrl}
          className="inline-flex rounded border border-primary px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary hover:text-on-primary transition-colors"
        >
          Track order
        </Link>
        <Link
          href="/shop"
          className="inline-flex rounded bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
