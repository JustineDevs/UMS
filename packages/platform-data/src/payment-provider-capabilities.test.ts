import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPaymentProviderCapabilities,
  paymentProviderSupports,
} from "./payment-provider-capabilities";

describe("payment provider capability registry", () => {
  it("keeps provider-specific checkout surfaces explicit", () => {
    assert.deepEqual(getPaymentProviderCapabilities("stripe").checkoutModes, [
      "hosted",
    ]);
    assert.deepEqual(getPaymentProviderCapabilities("paypal").checkoutModes, [
      "hosted",
    ]);
    assert.deepEqual(getPaymentProviderCapabilities("xendit").checkoutModes, [
      "hosted",
      "embedded",
    ]);
  });

  it("does not claim unsupported cross-provider capabilities", () => {
    assert.equal(paymentProviderSupports("stripe", "catalog_sync"), true);
    assert.equal(paymentProviderSupports("paypal", "catalog_sync"), false);
    assert.equal(paymentProviderSupports("xendit", "catalog_sync"), false);
    assert.equal(paymentProviderSupports("xendit", "channel_discovery"), true);
    assert.equal(paymentProviderSupports("paypal", "embedded_checkout"), false);
  });

  it("separates provider support from the UVS executable surface", () => {
    const stripe = getPaymentProviderCapabilities("stripe");
    const xendit = getPaymentProviderCapabilities("xendit");
    assert.equal(stripe.capabilities.includes("disputes"), true);
    assert.equal(stripe.implementedCapabilities.includes("disputes"), false);
    assert.equal(
      xendit.implementedCapabilities.includes("embedded_checkout"),
      false,
    );
    assert.equal(
      xendit.implementedCapabilities.includes("channel_discovery"),
      false,
    );
    assert.deepEqual(
      stripe.verifiedCapabilities,
      stripe.implementedCapabilities,
    );
  });
});
