import assert from "node:assert/strict";
import test from "node:test";
import { mapWorkerCatalogProductDetail } from "./catalog-product-service";

test("maps the Worker catalog contract into editable product, variant, stock, and media fields", () => {
  const detail = mapWorkerCatalogProductDetail({
    id: "prod_1",
    title: "Canary",
    handle: "canary",
    description: "A guitar",
    status: "published",
    thumbnail: "https://assets.test/canary.jpg",
    updated_at: "2026-09-20T01:02:03.000Z",
    metadata: { brand: "UVS", media_ids: ["asset_1"], guitar_specs_json: "[]" },
    images: [
      { id: "img_2", url: "https://assets.test/back.jpg", rank: 2 },
      { id: "img_1", url: "https://assets.test/front.jpg", rank: 1 },
    ],
    categories: [{ id: "cat_1", name: "Electric guitars", handle: "electric" }],
    options: [{ id: "opt_size", title: "Size" }, { id: "opt_color", title: "Color" }],
    variants: [{
      id: "variant_1",
      title: "M / Black",
      sku: "CAN-M-BLK",
      barcode: "123456",
      metadata: { legacy_compare_at_price_minor: 699900 },
      options: [{ title: "Size", value: "M" }, { title: "Color", value: "Black" }],
      prices: [{ amount: 599900, currency_code: "php" }],
      inventory_quantity: 8,
    }],
  });

  assert.ok(detail);
  assert.equal(detail.pricePhp, 5999);
  assert.equal(detail.currencyCode, "php");
  assert.equal(detail.stockQuantity, 8);
  assert.deepEqual(detail.imageUrls, ["https://assets.test/front.jpg", "https://assets.test/back.jpg"]);
  assert.deepEqual(detail.categoryIds, ["cat_1"]);
  assert.equal(detail.variantBarcode, "123456");
  assert.equal(detail.revision, "2026-09-20T01:02:03.000Z");
  assert.deepEqual(detail.storefrontMetadata.mediaIds, ["asset_1"]);
});

test("does not invent product data when the Worker returns no matching product", () => {
  assert.equal(mapWorkerCatalogProductDetail(null), null);
});
