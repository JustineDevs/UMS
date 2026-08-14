import { createStorefrontMedusaSdk } from "./medusa-sdk";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
} from "./storefront-medusa-env";

export type TrackPayload = {
  order: Record<string, unknown> & {
    id?: string;
    order_number?: string;
    status?: string;
  };
  shipments: Array<{
    id: string;
    tracking_number?: string;
    status?: string;
    carrier_slug?: string;
    expected_delivery?: string | null;
    tracking_url?: string | null;
  }>;
};

/** Build a carrier-specific tracking URL. Supports J&T Express PH and common Philippine couriers. */
function buildCarrierTrackingUrl(carrierSlug: string | undefined, trackingNumber: string | undefined): string | null {
  if (!trackingNumber?.trim()) return null;
  const slug = (carrierSlug ?? "").toLowerCase();
  const tn = encodeURIComponent(trackingNumber.trim());
  if (
    slug === "pancake-pos" ||
    slug === "pancake-pos-jt-ph" ||
    slug === "jtexpress-ph" ||
    slug === "jt" ||
    slug === "jt-express" ||
    slug === "jnt" ||
    slug === "jnt-express" ||
    slug === "j&t" ||
    slug === "j-t-express-ph"
  ) {
    return `https://www.jtexpress.ph/index/query/gcsSearch.html?bills=${tn}`;
  }
  if (slug === "lbc") {
    return `https://www.lbcexpress.com/track/?tracking_number=${tn}`;
  }
  if (slug === "2go" || slug === "2go-express") {
    return `https://www.2go.com.ph/track-shipment/?tracking=${tn}`;
  }
  return null;
}

export function orderTrackStatusFromMedusa(order: Record<string, unknown>): string {
  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const after =
    typeof meta.pancake_pos_status === "string"
      ? meta.pancake_pos_status
      : typeof meta.jnt_status === "string"
        ? meta.jnt_status
        : "";
  if (after === "delivered") return "delivered";
  if (after === "out_for_delivery") return "shipped";
  if (after === "in_transit" || after === "pending") return "shipped";

  if (
    meta.payment_provider === "cod" &&
    meta.cod_payment_status !== "captured" &&
    meta.cod_capture_complete !== true
  ) {
    return "pending_payment";
  }

  const pay = String(order.payment_status ?? "");
  if (pay !== "captured" && pay !== "partially_captured") {
    return "pending_payment";
  }

  const ful = String(order.fulfillment_status ?? "");
  if (ful === "delivered" || ful === "partially_delivered") return "delivered";
  if (
    ful === "shipped" ||
    ful === "partially_shipped" ||
    ful === "fulfilled" ||
    ful === "partially_fulfilled"
  ) {
    return "shipped";
  }
  return "paid";
}

function mapMedusaOrderToTrack(order: Record<string, unknown>): TrackPayload {
  const fulfillments = (order.fulfillments ?? []) as Array<
    Record<string, unknown>
  >;
  const shipments: TrackPayload["shipments"] = [];

  const orderMeta = (order.metadata ?? {}) as Record<string, unknown>;
  const jntEdd =
    typeof orderMeta.pancake_pos_expected_delivery === "string"
      ? orderMeta.pancake_pos_expected_delivery
      : typeof orderMeta.jnt_expected_delivery === "string"
        ? orderMeta.jnt_expected_delivery
        : null;

  const metadataShipments = Array.isArray(orderMeta.pancake_pos_shipments)
    ? (orderMeta.pancake_pos_shipments as Array<Record<string, unknown>>)
    : Array.isArray(orderMeta.fulfillment_shipments)
      ? (orderMeta.fulfillment_shipments as Array<Record<string, unknown>>)
      : [];

  if (metadataShipments.length > 0) {
    for (const shipment of metadataShipments) {
      const trackingNumber =
        typeof shipment.tracking_number === "string"
          ? shipment.tracking_number
          : undefined;
      const carrierSlug =
        typeof shipment.carrier_slug === "string"
          ? shipment.carrier_slug
          : undefined;
      shipments.push({
        id: String(shipment.id ?? "shipment"),
        tracking_number: trackingNumber,
        status:
          typeof shipment.status === "string"
            ? shipment.status
            : orderTrackStatusFromMedusa(order),
        carrier_slug: carrierSlug,
        expected_delivery:
          typeof shipment.expected_delivery === "string"
            ? shipment.expected_delivery
            : jntEdd,
        tracking_url: buildCarrierTrackingUrl(carrierSlug, trackingNumber),
      });
    }
  } else {
    for (const f of fulfillments) {
      const labels = (f.labels ?? []) as Array<Record<string, unknown>>;
      const carrierSlug = typeof f.provider_id === "string" ? f.provider_id : undefined;
      if (labels.length > 0) {
        for (const l of labels) {
          const trackingNumber = typeof l.tracking_number === "string" ? l.tracking_number : undefined;
          shipments.push({
            id: String(l.id ?? f.id ?? "lbl"),
            tracking_number: trackingNumber,
            status: orderTrackStatusFromMedusa(order),
            carrier_slug: carrierSlug,
            expected_delivery: jntEdd,
            tracking_url: buildCarrierTrackingUrl(carrierSlug, trackingNumber),
          });
        }
      } else {
        shipments.push({
          id: String(f.id ?? "ful"),
          tracking_number: undefined,
          status:
            typeof f.shipped_at === "string" || f.shipped_at
              ? "shipped"
              : "pending",
          carrier_slug: carrierSlug,
          expected_delivery: jntEdd,
          tracking_url: null,
        });
      }
    }
  }

  const displayId =
    order.display_id != null
      ? String(order.display_id)
      : String(order.id ?? "");

  return {
    order: {
      ...order,
      id: typeof order.id === "string" ? order.id : undefined,
      order_number: displayId,
      status: orderTrackStatusFromMedusa(order),
    },
    shipments,
  };
}

export async function fetchMedusaTrackByOrderId(orderId: string): Promise<{
  ok: boolean;
  data: TrackPayload | null;
  status: number;
}> {
  const key = getMedusaPublishableKey();
  if (!key) {
    return { ok: false, data: null, status: 503 };
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const { order } = await sdk.store.order.retrieve(orderId, {
      fields:
        "*fulfillments,*fulfillments.labels,+metadata,+payment_status,+fulfillment_status,+display_id",
    } as never);
    if (!order) {
      return { ok: false, data: null, status: 404 };
    }
    return {
      ok: true,
      data: mapMedusaOrderToTrack(order as unknown as Record<string, unknown>),
      status: 200,
    };
  } catch {
    return { ok: false, data: null, status: 404 };
  }
}

export async function fetchMedusaTrackByCartId(cartId: string): Promise<{
  ok: boolean;
  data: TrackPayload | null;
  status: number;
}> {
  const key = getMedusaPublishableKey();
  const regionId = getMedusaRegionId();
  if (!key || !regionId) {
    return { ok: false, data: null, status: 503 };
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const { cart } = await sdk.store.cart.retrieve(cartId, {
      fields:
        "id,completed_at,+order_id,*customer,*items,+total,*order,*order.fulfillments,*order.fulfillments.labels,+order.metadata,+order.payment_status,+order.fulfillment_status,+order.display_id",
    } as never);

    const cartRec = cart as unknown as Record<string, unknown> | undefined;
    const orderRaw = cartRec?.order as Record<string, unknown> | undefined;
    const linkedOrderId =
      orderRaw && typeof orderRaw.id === "string"
        ? orderRaw.id
        : typeof cartRec?.order_id === "string"
          ? cartRec.order_id
          : undefined;
    if (linkedOrderId) {
      return fetchMedusaTrackByOrderId(linkedOrderId);
    }

    if (cart?.completed_at) {
      return {
        ok: true,
        data: {
          order: {
            id: cartId,
            order_number: String(cartId).replace(/^cart_/, ""),
            status: "pending_payment",
          },
          shipments: [],
        },
        status: 200,
      };
    }

    return {
      ok: true,
      data: {
        order: {
          id: cartId,
          order_number: String(cartId).replace(/^cart_/, ""),
          status: "pending_payment",
        },
        shipments: [],
      },
      status: 200,
    };
  } catch {
    return { ok: false, data: null, status: 404 };
  }
}
