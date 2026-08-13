import assert from "node:assert/strict";
import test from "node:test";
import { catalogProductRequestSchema } from "./parse-catalog-product-body";

test("catalog product schema accepts the editor payload shape", () => {
  const result = catalogProductRequestSchema.safeParse({
    title: "Canary",
    handle: "canary",
    status: "draft",
    pricePhp: 1999,
    imageUrls: ["/media/canary.jpg"],
    sizeLabels: ["Default"],
    colorLabels: ["Natural"],
    storefrontMetadata: {
      brand: "UVS",
      seoDescription: "A guitar",
      weightKg: 2.5,
    },
  });
  assert.equal(result.success, true);
});

test("catalog product schema rejects unsafe nested metadata and media", () => {
  const result = catalogProductRequestSchema.safeParse({
    title: "Canary",
    pricePhp: 1999,
    imageUrls: ["javascript:alert(1)"],
    storefrontMetadata: {
      __proto__: { polluted: true },
      unsupported: "value",
    },
  });
  assert.equal(result.success, false);
});

test("catalog product schema rejects oversized money and unknown fields", () => {
  const result = catalogProductRequestSchema.safeParse({
    title: "Canary",
    pricePhp: 100_000_001,
    unknown: true,
  });
  assert.equal(result.success, false);
});
