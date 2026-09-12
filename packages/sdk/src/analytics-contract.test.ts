import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsEvent, createCanonicalMetricContract, normalizeCommerceAttribution } from "./analytics-contract.js";

test("analytics events reject unknown names and source mismatches", () => {
  assert.throws(() => createAnalyticsEvent("purchase", "storefront", {}));
  assert.throws(() => createAnalyticsEvent("page_view", "api", { path: "/" }));
});

test("analytics events enforce required properties and declared types", () => {
  assert.throws(() => createAnalyticsEvent("page_view", "storefront", {}));
  assert.throws(() => createAnalyticsEvent("page_view", "storefront", { path: 1 }));
  assert.doesNotThrow(() => createAnalyticsEvent("page_view", "storefront", { path: "/shop" }));
});

test("canonical metric contracts fix UTC windows and currency", () => {
  assert.deepEqual(createCanonicalMetricContract({
    name: "revenue", source: "medusa_orders", amountBasis: "order_total_minus_refunds",
    currency: "php", window: { start: "2026-01-01T00:00:00Z", end: "2026-02-01T00:00:00Z", timezone: "UTC" },
  }).currency, "PHP");
  assert.throws(() => createCanonicalMetricContract({
    name: "orders", source: "medusa_orders", amountBasis: "order_total", currency: "PHP",
    window: { start: "2026-02-01T00:00:00Z", end: "2026-01-01T00:00:00Z", timezone: "UTC" },
  }));
});

test("attribution is normalized before persistence", () => {
  assert.deepEqual(normalizeCommerceAttribution({ couponCode: " spring ", source: " ads " }), {
    couponCode: "SPRING", source: "ads", medium: undefined, campaign: undefined,
    campaignId: undefined, referralCode: undefined,
  });
});
