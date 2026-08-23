import { createStorefrontMedusaSdk } from "./medusa-sdk";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
} from "./storefront-medusa-env";
import { createHash, randomUUID } from "node:crypto";
import type { ResolvedTrackingCapability } from "@universal-music-store/sdk";

export type PublicTrackOrder = {
  id?: string;
  order_number?: string;
  status?: string;
  updated_at?: string;
};

export type TrackPayload = {
  order: PublicTrackOrder;
  confirmationOrder?: ConfirmationOrder;
  shipments: Array<{
    id: string;
    tracking_number?: string;
    status?: string;
    carrier_slug?: string;
    source?: string;
    updated_at?: string;
    expected_delivery?: string | null;
    tracking_url?: string | null;
  }>;
  /** Server-only ownership evidence used to validate scoped capabilities. */
  capabilityScope?: {
    customerEmailHash?: string;
    storeId?: string;
  };
};

export type TrackFreshness = "fresh" | "stale" | "unknown";

export type TrackReadResult = {
  ok: boolean;
  data: TrackPayload | null;
  status: number;
  /** Safe support reference; never contains an order, cart, or token identifier. */
  correlationId?: string;
};

export function trackReadFailure(status: number): TrackReadResult {
  return { ok: false, data: null, status, correlationId: randomUUID() };
}

export function trackingCapabilityScopeMatches(
  capability: ResolvedTrackingCapability | null,
  actual: TrackPayload["capabilityScope"] | undefined,
  configuredStoreId?: string,
): boolean {
  if (!capability?.scope) return true;
  if (
    capability.scope.customerEmailHash &&
    capability.scope.customerEmailHash !== actual?.customerEmailHash
  )
    return false;
  if (
    capability.scope.storeId &&
    capability.scope.storeId !== (actual?.storeId ?? configuredStoreId?.trim())
  )
    return false;
  return true;
}

export function pendingCartTrackPayload(): TrackPayload {
  return {
    order: { status: "pending_payment" },
    shipments: [],
  };
}

/** Keep carrier references readable while preventing control/whitespace injection in public views. */
export function formatTrackingNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 80) : undefined;
}

export function trackFreshness(
  updatedAt: string | undefined,
  now = Date.now(),
  maxAgeMs = 48 * 60 * 60 * 1000,
): TrackFreshness {
  const timestamp = Date.parse(updatedAt ?? "");
  if (!Number.isFinite(timestamp) || timestamp > now) return "unknown";
  return now - timestamp > maxAgeMs ? "stale" : "fresh";
}

function publicShipmentSource(
  value: unknown,
  fallback?: string,
): string | undefined {
  const source = typeof value === "string" ? value : fallback;
  const normalized = source?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return normalized ? normalized.slice(0, 64) : undefined;
}

function shipmentUpdatedAt(
  shipment: Record<string, unknown>,
  fallback?: string,
): string | undefined {
  for (const key of ["updated_at", "last_event_at", "occurred_at"]) {
    if (
      typeof shipment[key] === "string" &&
      Number.isFinite(Date.parse(shipment[key]))
    ) {
      return shipment[key] as string;
    }
  }
  return fallback;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row && typeof row === "object" && !Array.isArray(row)),
      )
    : [];
}

function publicShipmentStatus(value: unknown, fallback: string): string {
  return normalizeShipmentEventStatus(value) ?? fallback;
}

export type ConfirmationOrder = PublicTrackOrder & {
  display_id?: number | string;
  email?: string;
  items?: Array<{
    id: string;
    title?: string;
    quantity?: number;
    unit_price?: number;
    thumbnail?: string | null;
  }>;
  total?: number;
  shipping_address?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  } | null;
};

const PUBLIC_TRACK_ORDER_FIELDS =
  "id,display_id,updated_at,payment_status,fulfillment_status,email,+metadata,*fulfillments,*fulfillments.labels";

export type CarrierTrackingAdapter = {
  version: 1;
  host: string;
  buildUrl: (trackingNumber: string) => string;
};

const JNT_ADAPTER: CarrierTrackingAdapter = {
  version: 1,
  host: "www.jtexpress.ph",
  buildUrl: (trackingNumber) =>
    `https://www.jtexpress.ph/index/query/gcsSearch.html?bills=${encodeURIComponent(trackingNumber)}`,
};

const LBC_ADAPTER: CarrierTrackingAdapter = {
  version: 1,
  host: "www.lbcexpress.com",
  buildUrl: (trackingNumber) =>
    `https://www.lbcexpress.com/track/?tracking_number=${encodeURIComponent(trackingNumber)}`,
};

const TWO_GO_ADAPTER: CarrierTrackingAdapter = {
  version: 1,
  host: "www.2go.com.ph",
  buildUrl: (trackingNumber) =>
    `https://www.2go.com.ph/track-shipment/?tracking=${encodeURIComponent(trackingNumber)}`,
};

const CARRIER_ALIASES: Record<string, CarrierTrackingAdapter> = {
  "pancake-pos": JNT_ADAPTER,
  "pancake-pos-jt-ph": JNT_ADAPTER,
  "jtexpress-ph": JNT_ADAPTER,
  jt: JNT_ADAPTER,
  "jt-express": JNT_ADAPTER,
  jnt: JNT_ADAPTER,
  "jnt-express": JNT_ADAPTER,
  "j&t": JNT_ADAPTER,
  "j-t-express-ph": JNT_ADAPTER,
  lbc: LBC_ADAPTER,
  "2go": TWO_GO_ADAPTER,
  "2go-express": TWO_GO_ADAPTER,
};

/** Build a versioned, HTTPS-only carrier URL from the allowlisted adapter registry. */
export function buildCarrierTrackingUrl(
  carrierSlug: string | undefined,
  trackingNumber: string | undefined,
): string | null {
  const normalizedTrackingNumber = formatTrackingNumber(trackingNumber);
  if (!normalizedTrackingNumber) return null;
  const adapter = CARRIER_ALIASES[(carrierSlug ?? "").toLowerCase()];
  return adapter?.buildUrl(normalizedTrackingNumber) ?? null;
}

type ShipmentEventStatus = "pending_payment" | "paid" | "shipped" | "delivered";

const SHIPMENT_STATUS_RANK: Record<ShipmentEventStatus, number> = {
  pending_payment: 0,
  paid: 1,
  shipped: 2,
  delivered: 3,
};

function normalizeShipmentEventStatus(
  value: unknown,
): ShipmentEventStatus | null {
  if (typeof value !== "string") return null;
  if (value === "delivered") return "delivered";
  if (
    value === "out_for_delivery" ||
    value === "in_transit" ||
    value === "shipped"
  )
    return "shipped";
  if (value === "pending_payment") return "pending_payment";
  if (
    value === "registered" ||
    value === "paid" ||
    value === "ready_to_ship" ||
    value === "pending"
  )
    return "paid";
  return null;
}

/**
 * Resolve synchronized shipment events without allowing array order to decide
 * the customer-visible state. Invalid timestamps are ignored; equal timestamps
 * use the more progressed state so provider retries cannot move an order back.
 */
export function latestShipmentEventStatus(
  events: unknown,
): ShipmentEventStatus | null {
  if (!Array.isArray(events)) return null;
  let selected: { status: ShipmentEventStatus; occurredAt: number } | null =
    null;
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const row = event as Record<string, unknown>;
    const status = normalizeShipmentEventStatus(row.status);
    const occurredAt = Date.parse(
      typeof row.occurred_at === "string" ? row.occurred_at : "",
    );
    if (!status || !Number.isFinite(occurredAt)) continue;
    if (
      !selected ||
      occurredAt > selected.occurredAt ||
      (occurredAt === selected.occurredAt &&
        SHIPMENT_STATUS_RANK[status] > SHIPMENT_STATUS_RANK[selected.status])
    ) {
      selected = { status, occurredAt };
    }
  }
  return selected?.status ?? null;
}

export function orderTrackStatusFromMedusa(
  order: Record<string, unknown>,
): string {
  const meta =
    order.metadata &&
    typeof order.metadata === "object" &&
    !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const eventStatus = latestShipmentEventStatus(
    meta.pancake_pos_events ?? meta.shipment_events,
  );
  if (eventStatus) return eventStatus;
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

export function projectConfirmationOrder(
  order: Record<string, unknown>,
  publicOrder: TrackPayload["order"],
): ConfirmationOrder {
  const address = (order.shipping_address ?? null) as Record<
    string,
    unknown
  > | null;
  const items = Array.isArray(order.items)
    ? order.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        return [
          {
            id: String(row.id ?? "item"),
            ...(typeof row.title === "string" ? { title: row.title } : {}),
            ...(typeof row.quantity === "number"
              ? { quantity: row.quantity }
              : {}),
            ...(typeof row.unit_price === "number"
              ? { unit_price: row.unit_price }
              : {}),
            ...(typeof row.thumbnail === "string"
              ? { thumbnail: row.thumbnail }
              : {}),
          },
        ];
      })
    : [];

  return {
    ...publicOrder,
    display_id:
      typeof order.display_id === "number" ||
      typeof order.display_id === "string"
        ? order.display_id
        : undefined,
    email: typeof order.email === "string" ? order.email : undefined,
    items,
    total: typeof order.total === "number" ? order.total : undefined,
    shipping_address: address
      ? {
          ...(typeof address.address_1 === "string"
            ? { address_1: address.address_1 }
            : {}),
          ...(typeof address.address_2 === "string"
            ? { address_2: address.address_2 }
            : {}),
          ...(typeof address.city === "string" ? { city: address.city } : {}),
          ...(typeof address.province === "string"
            ? { province: address.province }
            : {}),
          ...(typeof address.postal_code === "string"
            ? { postal_code: address.postal_code }
            : {}),
        }
      : null,
  };
}

export function mapMedusaOrderToTrack(
  order: Record<string, unknown>,
  includePrivate = false,
): TrackPayload {
  const fulfillments = recordArray(order.fulfillments);
  const shipments: TrackPayload["shipments"] = [];
  const shipmentKeys = new Set<string>();

  const addShipment = (shipment: TrackPayload["shipments"][number]) => {
    const key = shipment.id || shipment.tracking_number;
    if (!key || shipmentKeys.has(key)) return;
    shipmentKeys.add(key);
    shipments.push(shipment);
  };

  const orderMeta =
    order.metadata &&
    typeof order.metadata === "object" &&
    !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const jntEdd =
    typeof orderMeta.pancake_pos_expected_delivery === "string"
      ? orderMeta.pancake_pos_expected_delivery
      : typeof orderMeta.jnt_expected_delivery === "string"
        ? orderMeta.jnt_expected_delivery
        : null;

  const primaryMetadataShipments = recordArray(
    orderMeta.pancake_pos_shipments,
  );
  const metadataShipments =
    primaryMetadataShipments.length > 0
      ? primaryMetadataShipments
      : recordArray(orderMeta.fulfillment_shipments);

  if (metadataShipments.length > 0) {
    for (const [shipmentIndex, shipment] of metadataShipments.entries()) {
      const trackingNumber = formatTrackingNumber(shipment.tracking_number);
      const carrierSlug =
        typeof shipment.carrier_slug === "string"
          ? shipment.carrier_slug
          : undefined;
      addShipment({
        id: String(shipment.id ?? `shipment-${shipmentIndex}`),
        tracking_number: trackingNumber,
        status: publicShipmentStatus(
          shipment.status,
          orderTrackStatusFromMedusa(order),
        ),
        carrier_slug: carrierSlug,
        source: publicShipmentSource(shipment.source, carrierSlug),
        updated_at: shipmentUpdatedAt(
          shipment,
          typeof order.updated_at === "string" ? order.updated_at : undefined,
        ),
        expected_delivery:
          typeof shipment.expected_delivery === "string"
            ? shipment.expected_delivery
            : jntEdd,
        tracking_url: buildCarrierTrackingUrl(carrierSlug, trackingNumber),
      });
    }
  } else {
    for (const f of fulfillments) {
      const labels = recordArray(f.labels);
      const carrierSlug =
        typeof f.provider_id === "string" ? f.provider_id : undefined;
      if (labels.length > 0) {
        for (const [labelIndex, l] of labels.entries()) {
          const trackingNumber = formatTrackingNumber(l.tracking_number);
          addShipment({
            id: String(l.id ?? `${f.id ?? "lbl"}-${labelIndex}`),
            tracking_number: trackingNumber,
            status: orderTrackStatusFromMedusa(order),
            carrier_slug: carrierSlug,
            source: publicShipmentSource(f.source, carrierSlug),
            updated_at: shipmentUpdatedAt(
              f,
              typeof order.updated_at === "string"
                ? order.updated_at
                : undefined,
            ),
            expected_delivery: jntEdd,
            tracking_url: buildCarrierTrackingUrl(carrierSlug, trackingNumber),
          });
        }
      } else {
        addShipment({
          id: String(f.id ?? "ful"),
          tracking_number: undefined,
          status:
            typeof f.shipped_at === "string" || f.shipped_at
              ? "shipped"
              : "pending",
          carrier_slug: carrierSlug,
          source: publicShipmentSource(f.source, carrierSlug),
          updated_at: shipmentUpdatedAt(
            f,
            typeof order.updated_at === "string" ? order.updated_at : undefined,
          ),
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

  const publicOrder = {
    order_number: displayId,
    status: orderTrackStatusFromMedusa(order),
    updated_at:
      typeof order.updated_at === "string" ? order.updated_at : undefined,
  };

  const orderEmail =
    typeof order.email === "string" ? order.email.trim().toLowerCase() : "";
  const metadata =
    order.metadata &&
    typeof order.metadata === "object" &&
    !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const storeId = ["organization_id", "store_id"]
    .map((key) => metadata[key])
    .find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
  const capabilityScope =
    orderEmail || storeId
      ? {
          ...(orderEmail
            ? {
                customerEmailHash: createHash("sha256")
                  .update(orderEmail)
                  .digest("hex"),
              }
            : {}),
          ...(storeId ? { storeId: storeId.trim().slice(0, 128) } : {}),
        }
      : undefined;

  return {
    order: publicOrder,
    ...(includePrivate
      ? { confirmationOrder: projectConfirmationOrder(order, publicOrder) }
      : {}),
    shipments,
    ...(capabilityScope ? { capabilityScope } : {}),
  };
}

export function medusaReadFailureStatus(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && Number.isInteger(status)) {
      if (
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 408 ||
        status === 409 ||
        status === 429
      ) {
        return status;
      }
      if (status >= 500 && status <= 599) return status;
    }
  }
  return 503;
}

export async function fetchMedusaTrackByOrderId(
  orderId: string,
  options?: { includePrivate?: boolean },
): Promise<TrackReadResult> {
  const key = getMedusaPublishableKey();
  if (!key) {
    return trackReadFailure(503);
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const { order } = await sdk.store.order.retrieve(orderId, {
      fields:
        options?.includePrivate === true
          ? "id,display_id,updated_at,payment_status,fulfillment_status,+metadata,email,total,currency_code,shipping_address,*items"
          : PUBLIC_TRACK_ORDER_FIELDS,
    } as never);
    if (!order) {
      return trackReadFailure(404);
    }
    return {
      ok: true,
      data: mapMedusaOrderToTrack(
        order as unknown as Record<string, unknown>,
        options?.includePrivate === true,
      ),
      status: 200,
    };
  } catch (error) {
    return trackReadFailure(medusaReadFailureStatus(error));
  }
}

export async function fetchMedusaTrackByCartId(
  cartId: string,
  options?: { includePrivate?: boolean },
): Promise<TrackReadResult> {
  const key = getMedusaPublishableKey();
  const regionId = getMedusaRegionId();
  if (!key || !regionId) {
    return trackReadFailure(503);
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
      return fetchMedusaTrackByOrderId(linkedOrderId, options);
    }

    if (cart?.completed_at) {
      return {
        ok: true,
        data: pendingCartTrackPayload(),
        status: 200,
      };
    }

    return {
      ok: true,
      data: pendingCartTrackPayload(),
      status: 200,
    };
  } catch (error) {
    return trackReadFailure(medusaReadFailureStatus(error));
  }
}
