import assert from "node:assert/strict";
import test from "node:test";

import { buildCheckoutQuoteFingerprint } from "./checkout-quote-fingerprint";

const baseInput = {
  currencyCode: "php",
  subtotal: 100,
  taxTotal: 12,
  shippingTotal: 10,
  discountTotal: 0,
  total: 122,
  lineSubtotalsByVariantId: {
    variant_b: 40,
    variant_a: 60,
  },
  variantIds: ["variant_b", "variant_a"],
  productIds: ["prod_1"],
  shippingMethodIds: ["ship_standard"],
  regionId: "reg_1",
};

test("buildCheckoutQuoteFingerprint is order-insensitive for ids and line subtotal keys", () => {
  const left = buildCheckoutQuoteFingerprint(baseInput);
  const right = buildCheckoutQuoteFingerprint({
    ...baseInput,
    variantIds: ["variant_a", "variant_b"],
    lineSubtotalsByVariantId: {
      variant_a: 60,
      variant_b: 40,
    },
  });

  assert.equal(left, right);
});

test("buildCheckoutQuoteFingerprint changes when totals change", () => {
  const left = buildCheckoutQuoteFingerprint(baseInput);
  const right = buildCheckoutQuoteFingerprint({
    ...baseInput,
    total: 123,
  });

  assert.notEqual(left, right);
});
