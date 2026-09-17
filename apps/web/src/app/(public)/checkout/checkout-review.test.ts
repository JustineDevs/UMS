import assert from "node:assert/strict";
import test from "node:test";

import { buildCheckoutReviewItems } from "./checkout-review";

test("buildCheckoutReviewItems reports line and total changes from the live quote", () => {
  const items = buildCheckoutReviewItems({
    lines: [
      {
        variantId: "variant_1",
        quantity: 2,
        slug: "guitar",
        name: "Electric Guitar",
        sku: "SKU-1",
        type: "M",
        finish: "Black",
        price: 100,
      },
    ],
    medusaPricePreview: {
      subtotal: 230,
      taxTotal: 27.6,
      shippingTotal: 10,
      discountTotal: 0,
      total: 267.6,
      currencyCode: "PHP",
      regionId: "reg_1",
      productIds: ["prod_1"],
      variantIds: ["variant_1"],
      shippingMethodIds: ["ship_standard"],
      quoteFingerprint: "qf_1",
      lineSubtotalsByVariantId: { variant_1: 230 },
      shippingOptions: [],
      appliedShippingOptionId: null,
    },
    localTax: 24,
    localTotal: 224,
  });

  assert.ok(items.some((item) => item.key === "line-variant_1"));
  assert.ok(items.some((item) => item.key === "total"));
});
