import assert from "node:assert/strict";
import test from "node:test";
import {
  findWorkerPosProduct,
  flattenWorkerPosProducts,
  mapWorkerPosVariant,
} from "./pos-worker-catalog";

const product = {
  id: "product_1",
  title: "Canary",
  thumbnail: "https://cdn.example.test/canary.jpg",
  variants: [
    {
      id: "variant_1",
      title: "White / Small",
      sku: "CANARY-S-W",
      barcode: "123456",
      calculated_price: { calculated_amount: 599700 },
    },
  ],
};

test("maps Worker catalog variants to the existing POS contract", () => {
  assert.deepEqual(mapWorkerPosVariant(product, product.variants[0]), {
    variantId: "variant_1",
    name: "Canary",
    sku: "CANARY-S-W",
    barcode: "123456",
    size: "White",
    color: "Small",
    price: 5997,
    imageUrl: "https://cdn.example.test/canary.jpg",
  });
});

test("flattens all variants without dropping valid zero-price products", () => {
  const items = flattenWorkerPosProducts([
    product,
    { id: "product_2", title: "No price", variants: [{ id: "variant_2" }] },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[1]?.price, 0);
});

test("finds an exact SKU or barcode without a legacy commerce SDK", () => {
  assert.equal(findWorkerPosProduct([product], "CANARY-S-W")?.variantId, "variant_1");
  assert.equal(findWorkerPosProduct([product], "123456")?.variantId, "variant_1");
  assert.equal(findWorkerPosProduct([product], "missing"), null);
});
