import assert from "node:assert/strict";
import test from "node:test";

import {
  pendingCartTrackPayload,
  buildCarrierTrackingUrl,
  formatTrackingNumber,
  latestShipmentEventStatus,
  mapMedusaOrderToTrack,
  medusaReadFailureStatus,
  orderTrackStatusFromMedusa,
  projectConfirmationOrder,
  trackFreshness,
  trackReadFailure,
  trackingCapabilityScopeMatches,
} from "./medusa-track-fetch";

test("tracking scope comparison fails closed for wrong customer or store", () => {
  const capability = {
    id: "order_1",
    scope: { customerEmailHash: "a".repeat(64), storeId: "store_a" },
  };
  assert.equal(
    trackingCapabilityScopeMatches(capability, {
      customerEmailHash: "a".repeat(64),
      storeId: "store_a",
    }),
    true,
  );
  assert.equal(
    trackingCapabilityScopeMatches(capability, {
      customerEmailHash: "b".repeat(64),
      storeId: "store_a",
    }),
    false,
  );
  assert.equal(
    trackingCapabilityScopeMatches(capability, undefined, "store_b"),
    false,
  );
});

test("pending cart tracking projection does not expose the raw cart identifier", () => {
  const payload = pendingCartTrackPayload();
  assert.equal(payload.order.id, undefined);
  assert.equal(payload.order.order_number, undefined);
  assert.equal(payload.order.status, "pending_payment");
});

test("track freshness distinguishes current, stale, invalid, and future timestamps", () => {
  const now = Date.parse("2026-08-22T12:00:00.000Z");
  assert.equal(trackFreshness("2026-08-22T11:00:00.000Z", now), "fresh");
  assert.equal(trackFreshness("2026-08-19T11:00:00.000Z", now), "stale");
  assert.equal(trackFreshness("not-a-date", now), "unknown");
  assert.equal(trackFreshness("2026-08-23T11:00:00.000Z", now), "unknown");
});

test("tracking fetch preserves safe upstream error taxonomy", () => {
  assert.equal(medusaReadFailureStatus({ status: 404 }), 404);
  assert.equal(medusaReadFailureStatus({ status: 429 }), 429);
  assert.equal(medusaReadFailureStatus({ status: 503 }), 503);
  assert.equal(medusaReadFailureStatus({ status: 401 }), 401);
  assert.equal(medusaReadFailureStatus({ status: 418 }), 503);
  assert.equal(medusaReadFailureStatus(new Error("network")), 503);
});

test("tracking failures receive opaque support correlation ids", () => {
  const failure = trackReadFailure(503);
  assert.equal(failure.ok, false);
  assert.equal(failure.status, 503);
  assert.match(failure.correlationId ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(failure.data, null);
});

test("carrier tracking links use the HTTPS allowlist and encode tracking numbers", () => {
  assert.equal(
    buildCarrierTrackingUrl("jtexpress-ph", "JT 123&456"),
    "https://www.jtexpress.ph/index/query/gcsSearch.html?bills=JT%20123%26456",
  );
  assert.equal(
    buildCarrierTrackingUrl("lbc", "LBC-1"),
    "https://www.lbcexpress.com/track/?tracking_number=LBC-1",
  );
  assert.equal(
    buildCarrierTrackingUrl("2go", "2GO-1"),
    "https://www.2go.com.ph/track-shipment/?tracking=2GO-1",
  );
  assert.equal(buildCarrierTrackingUrl("unknown-carrier", "ABC"), null);
  assert.equal(buildCarrierTrackingUrl("jnt", ""), null);
});

test("tracking number display normalizes whitespace and bounds untrusted input", () => {
  assert.equal(formatTrackingNumber("  JT\n 123\t456  "), "JT 123 456");
  assert.equal(formatTrackingNumber("\u0000\u0001"), undefined);
  assert.equal(formatTrackingNumber("x".repeat(100))?.length, 80);
});

test("carrier adapters are versioned and use the approved HTTPS hosts", () => {
  const links = [
    buildCarrierTrackingUrl("jnt", "JT-1"),
    buildCarrierTrackingUrl("lbc", "LBC-1"),
    buildCarrierTrackingUrl("2go", "2GO-1"),
  ];
  assert.ok(links.every((link) => link?.startsWith("https://")));
  assert.deepEqual(
    [...new Set(links.map((link) => new URL(link!).hostname))].sort(),
    ["www.2go.com.ph", "www.jtexpress.ph", "www.lbcexpress.com"],
  );
});

test("public tracking projection excludes private Medusa order fields", () => {
  const result = mapMedusaOrderToTrack({
    id: "order_public",
    display_id: 42,
    updated_at: "2026-08-22T00:00:00.000Z",
    payment_status: "captured",
    fulfillment_status: "not_fulfilled",
    metadata: {},
    email: "private@example.com",
    total: 999,
    shipping_address: { address_1: "private" },
    private_payment_collection: { id: "secret" },
  });

  assert.deepEqual(result.order, {
    order_number: "42",
    status: "paid",
    updated_at: "2026-08-22T00:00:00.000Z",
  });
  assert.equal("email" in result.order, false);
  assert.equal("private_payment_collection" in result.order, false);
});

test("tracking projection preserves bounded shipment freshness and source", () => {
  const result = mapMedusaOrderToTrack({
    id: "order_public",
    updated_at: "2026-08-22T00:00:00.000Z",
    metadata: {
      pancake_pos_shipments: [
        {
          id: "shipment_1",
          tracking_number: "JT-1",
          carrier_slug: "jnt",
          source: `Pancake\u0000${"x".repeat(100)}`,
          last_event_at: "2026-08-19T00:00:00.000Z",
        },
      ],
    },
  });

  assert.equal(result.shipments[0]?.updated_at, "2026-08-19T00:00:00.000Z");
  assert.equal(result.shipments[0]?.source?.length, 64);
  assert.equal(result.shipments[0]?.source?.includes("\u0000"), false);
  assert.equal(
    trackFreshness(
      result.shipments[0]?.updated_at,
      Date.parse("2026-08-22T00:00:00.000Z"),
    ),
    "stale",
  );
});

test("tracking projection ignores malformed metadata and deduplicates shipments", () => {
  const result = mapMedusaOrderToTrack({
    payment_status: "captured",
    fulfillment_status: "fulfilled",
    metadata: {
      pancake_pos_shipments: [
        null,
        { id: "shipment-1", tracking_number: "JT-1", status: "delivered" },
        { id: "shipment-1", tracking_number: "JT-1", status: "unknown-provider-state" },
      ],
    },
  });

  assert.equal(result.shipments.length, 1);
  assert.equal(result.shipments[0]?.status, "delivered");
});

test("tracking projection falls back to fulfillment shipments when metadata is empty", () => {
  const result = mapMedusaOrderToTrack({
    payment_status: "captured",
    fulfillment_status: "fulfilled",
    metadata: { pancake_pos_shipments: [] },
    fulfillments: [
      {
        id: "fulfillment-1",
        provider_id: "jnt",
        labels: [{ id: "label-1", tracking_number: "JT-2" }],
      },
    ],
  });

  assert.equal(result.shipments.length, 1);
  assert.equal(result.shipments[0]?.tracking_number, "JT-2");
});

test("tracking status treats null metadata as empty metadata", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      metadata: null,
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
    }),
    "paid",
  );
});

test("projectConfirmationOrder keeps only approved confirmation fields", () => {
  const result = projectConfirmationOrder(
    {
      id: "order_123",
      display_id: 123,
      email: "buyer@example.com",
      total: 12500,
      items: [
        {
          id: "item_1",
          title: "Piano",
          quantity: 1,
          unit_price: 12500,
          thumbnail: "/piano.jpg",
          variant: { sku: "SECRET-SKU" },
        },
      ],
      shipping_address: {
        address_1: "1 Main St",
        city: "Manila",
        phone: "0917",
      },
      payment_collections: [{ id: "private-payment" }],
      metadata: { internal_note: "private" },
    },
    { id: "order_123", order_number: "123", status: "paid" },
  );

  assert.deepEqual(result, {
    id: "order_123",
    order_number: "123",
    status: "paid",
    display_id: 123,
    email: "buyer@example.com",
    items: [
      {
        id: "item_1",
        title: "Piano",
        quantity: 1,
        unit_price: 12500,
        thumbnail: "/piano.jpg",
      },
    ],
    total: 12500,
    shipping_address: { address_1: "1 Main St", city: "Manila" },
  });
  assert.equal("payment_collections" in result, false);
  assert.equal("metadata" in result, false);
});

test("orderTrackStatusFromMedusa returns pending_payment when payment is not captured", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "awaiting",
      fulfillment_status: "not_fulfilled",
      metadata: {},
    }),
    "pending_payment",
  );
});

test("latest shipment event status uses timestamp and progress precedence", () => {
  assert.equal(
    latestShipmentEventStatus([
      { status: "delivered", occurred_at: "2026-08-21T12:00:00.000Z" },
      { status: "in_transit", occurred_at: "2026-08-22T12:00:00.000Z" },
      { status: "not-a-state", occurred_at: "2026-08-23T12:00:00.000Z" },
    ]),
    "shipped",
  );
  assert.equal(
    latestShipmentEventStatus([
      { status: "shipped", occurred_at: "2026-08-22T12:00:00.000Z" },
      { status: "delivered", occurred_at: "2026-08-22T12:00:00.000Z" },
    ]),
    "delivered",
  );
  assert.equal(latestShipmentEventStatus([{ status: "delivered" }]), null);
  assert.deepEqual(
    ["registered", "in_transit", "out_for_delivery", "delivered"].map(
      (status) =>
        latestShipmentEventStatus([
          { status, occurred_at: "2026-08-22T12:00:00.000Z" },
        ]),
    ),
    ["paid", "shipped", "shipped", "delivered"],
  );
});

test("order tracking prefers the synchronized event ledger over legacy metadata", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "captured",
      fulfillment_status: "fulfilled",
      metadata: {
        pancake_pos_status: "delivered",
        pancake_pos_events: [
          { status: "shipped", occurred_at: "2026-08-22T12:00:00.000Z" },
        ],
      },
    }),
    "shipped",
  );
});

test("orderTrackStatusFromMedusa prefers Pancake POS delivered metadata", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "captured",
      fulfillment_status: "fulfilled",
      metadata: { pancake_pos_status: "delivered" },
    }),
    "delivered",
  );
});

test("orderTrackStatusFromMedusa maps in_transit Pancake POS metadata to shipped", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      metadata: { pancake_pos_status: "in_transit" },
    }),
    "shipped",
  );
});

test("orderTrackStatusFromMedusa returns delivered for fulfilled captured orders", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "captured",
      fulfillment_status: "delivered",
      metadata: {},
    }),
    "delivered",
  );
});

test("orderTrackStatusFromMedusa returns shipped for partially fulfilled captured orders", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "captured",
      fulfillment_status: "partially_fulfilled",
      metadata: {},
    }),
    "shipped",
  );
});

test("orderTrackStatusFromMedusa returns paid when payment captured but fulfillment not shipped", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      metadata: {},
    }),
    "paid",
  );
});

test("orderTrackStatusFromMedusa treats partially captured orders as paid progress", () => {
  assert.equal(
    orderTrackStatusFromMedusa({
      payment_status: "partially_captured",
      fulfillment_status: "not_fulfilled",
      metadata: {},
    }),
    "paid",
  );
});
