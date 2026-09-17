import assert from "node:assert/strict";
import test from "node:test";

import { buildCheckoutReviewItems } from "@/app/(public)/checkout/checkout-review";
import { resolveCheckoutPaymentAvailability } from "@/lib/checkout-payment-availability";
import { isStaleCheckoutMessage } from "@/lib/checkout-errors";

test("integration: checkout review lists structured total change when preview differs", () => {
  const items = buildCheckoutReviewItems({
    lines: [
      {
        variantId: "v1",
        quantity: 1,
        slug: "x",
        name: "Item",
        sku: "S",
        type: "M",
        finish: "Black",
        price: 100,
      },
    ],
    medusaPricePreview: {
      subtotal: 150,
      taxTotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      total: 150,
      currencyCode: "PHP",
      regionId: "r1",
      productIds: ["p1"],
      variantIds: ["v1"],
      shippingMethodIds: [],
      quoteFingerprint: "qf2",
      lineSubtotalsByVariantId: { v1: 150 },
      shippingOptions: [],
      appliedShippingOptionId: null,
    },
    localTax: 0,
    localTotal: 100,
  });
  const totalRow = items.find((i) => i.key === "total");
  assert.ok(totalRow);
  assert.ok(String(totalRow?.message ?? "").includes("final total"));
});

test("integration: missing Worker payment keys disable availability", () => {
  const a = resolveCheckoutPaymentAvailability(null);
  const b = resolveCheckoutPaymentAvailability(undefined);
  assert.equal(a.source, "unavailable");
  assert.equal(b.source, "unavailable");
});

test("integration: empty Worker payment keys disable all providers", () => {
  const { available, source } = resolveCheckoutPaymentAvailability([]);
  assert.equal(source, "unavailable");
  assert.equal(available.STRIPE, false);
});

test("integration: config and auth checkout errors are not treated as stale-session review banners", () => {
  assert.equal(
    isStaleCheckoutMessage("Worker provider credentials are unavailable"),
    false,
  );
  assert.equal(
    isStaleCheckoutMessage("Sign in to load checkout totals."),
    false,
  );
  assert.equal(
    isStaleCheckoutMessage(
      "Review the updated total below before continuing to payment.",
    ),
    true,
  );
});
