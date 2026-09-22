import assert from "node:assert/strict";
import test from "node:test";
import { searchCatalogVariantLines } from "./chat-order-catalog-search";
import type { WorkerAdminCatalogProduct } from "./worker-admin-bridge";

type FetchProducts = NonNullable<Parameters<typeof searchCatalogVariantLines>[2]>;

function product(index: number): WorkerAdminCatalogProduct {
  return {
    id: `product-${index}`,
    title: ` Product ${index} `,
    handle: `product-${index}`,
    status: "published",
    thumbnail: null,
    variantCount: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    categories: [],
    options: [],
    variants: [{ id: `variant-${index}`, sku: ` SKU-${index} ` }],
  };
}

test("does not call the Worker for queries shorter than two characters", async () => {
  let calls = 0;
  const fetchProducts: FetchProducts = async () => {
    calls += 1;
    return { products: [], count: 0 };
  };

  assert.deepEqual(await searchCatalogVariantLines(" x ", 12, fetchProducts), { lines: [] });
  assert.equal(calls, 0);
});

test("preserves a valid empty result separately from Worker unavailability", async () => {
  const emptyFetcher: FetchProducts = async () => ({ products: [], count: 0 });
  const unavailableFetcher: FetchProducts = async () => ({
    products: [],
    count: 0,
    commerceUnavailable: true,
  });

  assert.deepEqual(await searchCatalogVariantLines("guitar", 12, emptyFetcher), { lines: [] });
  assert.deepEqual(await searchCatalogVariantLines("guitar", 12, unavailableFetcher), { unavailable: true });
});

test("maps and bounds Worker variant suggestions", async () => {
  const fetchProducts: FetchProducts = async (options) => {
    assert.deepEqual(options, { limit: 12, offset: 0, q: "guitar", status: "published" });
    return { products: Array.from({ length: 45 }, (_, index) => product(index + 1)), count: 45 };
  };

  const result = await searchCatalogVariantLines(" guitar ", 12, fetchProducts);
  assert.ok("lines" in result);
  assert.equal(result.lines.length, 40);
  assert.deepEqual(result.lines[0], {
    variantId: "variant-1",
    label: "Product 1 — SKU-1",
    productTitle: "Product 1",
    sku: "SKU-1",
  });
});
