import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_CATALOG_METADATA_FIELDS } from "./catalog-product-metadata";
import type { CatalogProductDetail } from "./medusa-catalog-service";
import {
  buildStorefrontCommerceInvalidationPayload,
  classifyCatalogMutation,
} from "./storefront-commerce-invalidation";

function metaSig(m: typeof EMPTY_CATALOG_METADATA_FIELDS): string {
  return JSON.stringify({
    brand: m.brand,
    videoUrl: m.videoUrl,
    galleryVideoUrlsText: m.galleryVideoUrlsText,
    weightKg: m.weightKg,
    dimensionsLabel: m.dimensionsLabel,
    material: m.material,
    lifestyleImageUrl: m.lifestyleImageUrl,
    seoDescription: m.seoDescription,
    relatedHandlesText: m.relatedHandlesText,
    hotspotsJson: m.hotspotsJson,
  });
}

function stockRow(): CatalogProductDetail["variantStockRows"][number] {
  return {
    variantId: "v1",
    sizeLabel: "S",
    colorLabel: "Red",
    label: "S / Red",
    stockedQuantity: 3,
  };
}

function base(overrides: Partial<CatalogProductDetail> = {}): CatalogProductDetail {
  const sm = { ...EMPTY_CATALOG_METADATA_FIELDS };
  const editorial = "Title\u0001\u0001\u0001";
  return {
    id: "p1",
    title: "Title",
    handle: "h",
    description: null,
    status: "published",
    thumbnail: null,
    imageUrls: [],
    variantCount: 1,
    variantId: "v1",
    sku: null,
    pricePhp: 10,
    currencyCode: "php",
    categoryIds: ["c1"],
    categoryHandles: ["tops"],
    categoryLabels: ["Cat"],
    sizeLabel: "S",
    colorLabel: "Red",
    matrixSizes: ["S"],
    matrixColors: ["Red"],
    shopVariantOptionsReady: true,
    stockQuantity: 3,
    variantStockRows: [stockRow()],
    variantBarcode: null,
    storefrontMetadata: sm,
    variantSellPriceSignature: "v1:1000",
    variantCompareAtSignature: "v1:none",
    editorialSurfaceSignature: editorial,
    storefrontMetadataSignature: metaSig(sm),
    ...overrides,
  };
}

test("classifyCatalogMutation: sell price signature change is checkout_affecting", () => {
  const before = base();
  const after = base({
    variantSellPriceSignature: "v1:2000",
    pricePhp: 20,
  });
  assert.equal(classifyCatalogMutation(before, after), "checkout_affecting");
});

test("classifyCatalogMutation: price change wins over concurrent stock delta", () => {
  const before = base();
  const after = base({
    variantSellPriceSignature: "v1:9999",
    variantStockRows: [{ ...stockRow(), stockedQuantity: 0 }],
    stockQuantity: 0,
    pricePhp: 99,
  });
  assert.equal(classifyCatalogMutation(before, after), "checkout_affecting");
});

test("classifyCatalogMutation: stock only is sellability_affecting", () => {
  const before = base();
  const after = base({
    variantStockRows: [{ ...stockRow(), stockedQuantity: 0 }],
    stockQuantity: 0,
  });
  assert.equal(classifyCatalogMutation(before, after), "sellability_affecting");
});

test("classifyCatalogMutation: status only is sellability_affecting", () => {
  const before = base();
  const after = base({ status: "draft" });
  assert.equal(classifyCatalogMutation(before, after), "sellability_affecting");
});

test("classifyCatalogMutation: compare-at only is merchandising_only", () => {
  const before = base();
  const after = base({ variantCompareAtSignature: "v1:5000" });
  assert.equal(classifyCatalogMutation(before, after), "merchandising_only");
});

test("classifyCatalogMutation: storefront metadata only is merchandising_only", () => {
  const before = base();
  const sm = { ...EMPTY_CATALOG_METADATA_FIELDS, brand: "X" };
  const after = base({
    storefrontMetadata: sm,
    storefrontMetadataSignature: metaSig(sm),
  });
  assert.equal(classifyCatalogMutation(before, after), "merchandising_only");
});

test("classifyCatalogMutation: editorial surface only is editorial_only", () => {
  const before = base();
  const after = base({
    title: "New",
    editorialSurfaceSignature: "New\u0001\u0001\u0001",
  });
  assert.equal(classifyCatalogMutation(before, after), "editorial_only");
});

test("classifyCatalogMutation: null before is checkout_affecting", () => {
  const after = base();
  assert.equal(classifyCatalogMutation(null, after), "checkout_affecting");
});

test("buildStorefrontCommerceInvalidationPayload merges category handles for collection tags", () => {
  const before = base({ categoryHandles: ["sale", "tops"] });
  const after = base({ categoryHandles: ["tops", "new-in"] });
  const payload = buildStorefrontCommerceInvalidationPayload({
    classification: "sellability_affecting",
    before,
    after,
    actorEmail: "ops@example.com",
  });
  assert.deepEqual(payload.collectionHandles, ["new-in", "sale", "tops"]);
  assert.equal(payload.classification, "sellability_affecting");
});
