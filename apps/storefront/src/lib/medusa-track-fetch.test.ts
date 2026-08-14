import assert from "node:assert/strict";
import test from "node:test";

import { orderTrackStatusFromMedusa } from "./medusa-track-fetch";

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
