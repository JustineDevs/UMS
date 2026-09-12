import assert from "node:assert/strict";
import test from "node:test";

import { filterConnectedPaymentProviders } from "./store-payment-availability";

test("wallets require an active organization connection while COD remains region-controlled", () => {
  assert.deepEqual(
    filterConnectedPaymentProviders(
      ["STRIPE", "PAYPAL", "XENDIT", "COD"],
      [{ provider_config_key: "paypal-sandbox", active: true }],
      { xenditConfigured: false },
    ),
    ["PAYPAL", "COD"],
  );
});

test("wallets ignore active connections owned by another organization", () => {
  assert.deepEqual(
    filterConnectedPaymentProviders(
      ["STRIPE", "PAYPAL", "COD"],
      [{ organization_id: "org_other", provider: "stripe", active: true }],
      { organizationId: "org_store", xenditConfigured: false },
    ),
    ["COD"],
  );
});

test("Xendit requires both server credentials unless an active connection exists", () => {
  assert.deepEqual(
    filterConnectedPaymentProviders(
      ["XENDIT", "COD"],
      [],
      { xenditConfigured: false },
    ),
    ["COD"],
  );
  assert.deepEqual(
    filterConnectedPaymentProviders(
      ["XENDIT", "COD"],
      [],
      { xenditConfigured: true },
    ),
    ["XENDIT", "COD"],
  );
});

test("local sandbox credentials enable direct Stripe and PayPal without a Nango row", () => {
  assert.deepEqual(
    filterConnectedPaymentProviders(
      ["STRIPE", "PAYPAL", "COD"],
      [],
      { stripeConfigured: true, paypalConfigured: true, xenditConfigured: false },
    ),
    ["STRIPE", "PAYPAL", "COD"],
  );
});
