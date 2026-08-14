/**
 * Contract tests: shop listing defaults shared between storefront and validation package.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { productListQuerySchema, SHOP_PRODUCT_PAGE_SIZE } from "./index";

test("SHOP_PRODUCT_PAGE_SIZE is stable (storefront shop listing default)", () => {
  assert.equal(SHOP_PRODUCT_PAGE_SIZE, 20);
});

test("productListQuerySchema accepts shop default limit with SHOP_PRODUCT_PAGE_SIZE", () => {
  const parsed = productListQuerySchema.parse({
    limit: SHOP_PRODUCT_PAGE_SIZE,
  });
  assert.equal(parsed.limit, 20);
});

test("empty query + storefront merge pattern: explicit limit matches SHOP_PRODUCT_PAGE_SIZE", () => {
  const empty = productListQuerySchema.parse({});
  assert.equal(empty.limit, undefined);
  const mergedLimit = empty.limit ?? SHOP_PRODUCT_PAGE_SIZE;
  assert.equal(mergedLimit, 20);
  const withMerged = productListQuerySchema.parse({ limit: mergedLimit });
  assert.equal(withMerged.limit, SHOP_PRODUCT_PAGE_SIZE);
});
