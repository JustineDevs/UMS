import assert from "node:assert/strict";
import test from "node:test";

import { resolveCheckoutPaymentAvailability } from "./checkout-payment-availability";

test("resolveCheckoutPaymentAvailability: Worker keys drive availability", () => {
  const { available, source } = resolveCheckoutPaymentAvailability([
    "STRIPE",
    "COD",
  ]);
  assert.equal(source, "worker");
  assert.equal(available.STRIPE, true);
  assert.equal(available.COD, true);
  assert.equal(available.PAYPAL, false);
  assert.equal(available.XENDIT, false);
});

test("resolveCheckoutPaymentAvailability: empty Worker list disables all methods", () => {
  const { available, source } = resolveCheckoutPaymentAvailability([]);
  assert.equal(source, "unavailable");
  assert.equal(available.STRIPE, false);
  assert.equal(available.COD, false);
});

test("resolveCheckoutPaymentAvailability: missing Worker response disables all methods", () => {
  const { available, source } = resolveCheckoutPaymentAvailability(undefined);
  assert.equal(source, "unavailable");
  assert.equal(available.STRIPE, false);
  assert.equal(available.COD, false);
  assert.equal(available.PAYPAL, false);
  assert.equal(available.XENDIT, false);
});
