import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCheckoutPaymentAvailability,
  getEnvOnlyCheckoutPaymentAvailability,
} from "./checkout-payment-availability";

test("resolveCheckoutPaymentAvailability: region keys drive availability (provider removed from region)", () => {
  const { available, source } = resolveCheckoutPaymentAvailability(["STRIPE", "COD"]);
  assert.equal(source, "medusa");
  assert.equal(available.STRIPE, true);
  assert.equal(available.COD, true);
  assert.equal(available.PAYPAL, false);
  assert.equal(available.XENDIT, false);
});

test("resolveCheckoutPaymentAvailability: empty region list disables all methods", () => {
  const { available, source } = resolveCheckoutPaymentAvailability([]);
  assert.equal(source, "medusa");
  assert.equal(available.STRIPE, false);
  assert.equal(available.COD, false);
});

test("resolveCheckoutPaymentAvailability: undefined uses env-driven allowlist (explicit keys only)", () => {
  const prev = process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS;
  process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS = "STRIPE,COD";
  try {
    const { available, source } = resolveCheckoutPaymentAvailability(undefined);
    assert.equal(source, "env");
    assert.equal(available.STRIPE, true);
    assert.equal(available.COD, true);
    assert.equal(available.PAYPAL, false);
  } finally {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS;
    } else {
      process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS = prev;
    }
  }
});

test("getEnvOnlyCheckoutPaymentAvailability: shows only COD when NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS is unset", () => {
  const prev = process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS;
  delete process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS;
  try {
    const { available } = getEnvOnlyCheckoutPaymentAvailability();
    assert.equal(available.COD, true, "COD must be available as safe default");
    assert.equal(available.STRIPE, false, "Stripe must NOT be available when key not configured");
    assert.equal(available.PAYPAL, false, "PayPal must NOT be available when key not configured");
    assert.equal(available.XENDIT, false, "Xendit must NOT be available when key not configured");
  } finally {
    if (prev !== undefined) {
      process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS = prev;
    }
  }
});

test("getEnvOnlyCheckoutPaymentAvailability: explicit NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS shows listed providers", () => {
  const prev = process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS;
  process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS = "STRIPE,COD";
  try {
    const { available } = getEnvOnlyCheckoutPaymentAvailability();
    assert.equal(available.STRIPE, true);
    assert.equal(available.COD, true);
    assert.equal(available.PAYPAL, false);
    assert.equal(available.XENDIT, false);
  } finally {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS;
    } else {
      process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS = prev;
    }
  }
});
