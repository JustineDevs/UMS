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

test("catalog product schema accepts typed guitar specs and audio demos", () => {
  const result = catalogProductRequestSchema.safeParse({
    title: "Studio Guitar",
    pricePhp: 1999,
    storefrontMetadata: {
      guitarSpecsJson: JSON.stringify({ bodyShape: "Dreadnought", fretCount: 20 }),
      audioDemosJson: JSON.stringify([{ url: "/media/clean.mp3", title: "Clean tone" }]),
    },
  });
  assert.equal(result.success, true);
});

test("catalog product schema rejects fabricated or unsafe structured metadata", () => {
  const result = catalogProductRequestSchema.safeParse({
    title: "Studio Guitar",
    storefrontMetadata: {
      guitarSpecsJson: JSON.stringify({ madeUpField: "unknown" }),
      audioDemosJson: JSON.stringify([{ url: "javascript:alert(1)", title: "Bad" }]),
    },
  });
  assert.equal(result.success, false);
});

test("catalog product schema accepts bounded trust content", () => {
  const result = catalogProductRequestSchema.safeParse({
    title: "Studio Guitar",
    storefrontMetadata: {
      trustContentJson: JSON.stringify({
        conditionGrade: "New",
        setupAndInspection: "Inspected before dispatch",
        includedAccessories: ["Gig bag"],
      }),
    },
  });
  assert.equal(result.success, true);
});

test("catalog product schema blocks incomplete published products", () => {
  const result = catalogProductRequestSchema.safeParse({
    status: "published",
    title: "Studio Guitar",
    handle: "studio-guitar",
    pricePhp: 1999,
    storefrontMetadata: {
      guitarSpecsJson: JSON.stringify({ bodyShape: "Dreadnought" }),
    },
  });
  assert.equal(result.success, false);
});
