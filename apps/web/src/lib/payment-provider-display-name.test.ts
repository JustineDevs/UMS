import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPaymentProviderDisplayName } from "./payment-provider-display-name";

describe("getPaymentProviderDisplayName", () => {
  it("maps known Medusa-style ids to friendly labels", () => {
    assert.equal(getPaymentProviderDisplayName("pp_cod_cod"), "Cash on delivery (COD)");
    assert.equal(getPaymentProviderDisplayName("pp_paypal_paypal"), "PayPal");
    assert.equal(getPaymentProviderDisplayName("pp_stripe_stripe"), "Stripe");
    assert.equal(getPaymentProviderDisplayName("pp_system_default"), "System default");
  });

  it("labels Stripe method variants", () => {
    assert.equal(
      getPaymentProviderDisplayName("pp_stripe-ideal_stripe"),
      "Stripe (iDEAL)",
    );
    assert.equal(
      getPaymentProviderDisplayName("pp_stripe-bancontact_stripe"),
      "Stripe (Bancontact)",
    );
  });
});
