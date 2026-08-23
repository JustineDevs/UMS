import assert from "node:assert/strict";
import test from "node:test";

import {
  parseShopPageQuery,
  parseShopPageQueryDiagnostics,
  shopPageShouldNoIndex,
} from "./shop-page-query";

test("parseShopPageQuery preserves valid filters when only price bounds are invalid", () => {
  const parsed = parseShopPageQuery({
    category: "guitars",
    sort: "price_asc",
    offset: "20",
    minPrice: "-1",
    maxPrice: "not-a-number",
  });

  assert.equal(parsed.category, "guitars");
  assert.equal(parsed.sort, "price_asc");
  assert.equal(parsed.offset, 20);
  assert.equal(parsed.minPrice, undefined);
  assert.equal(parsed.maxPrice, undefined);
});

test("parseShopPageQuery falls back to defaults when non-price query state is invalid", () => {
  const parsed = parseShopPageQuery({
    category: "",
    sort: "newest",
    offset: "oops",
  });

  assert.equal(parsed.sort, "newest");
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.category, undefined);
});

test("parseShopPageQueryDiagnostics preserves valid filters while identifying invalid keys", () => {
  const result = parseShopPageQueryDiagnostics({
    category: "guitars",
    type: "electric",
    offset: "not-a-number",
  });
  assert.deepEqual(result.invalidKeys, ["offset"]);
  assert.equal(result.query.category, "guitars");
  assert.equal(result.query.type, "electric");
  assert.equal(result.query.offset, 0);
});

test("shop SEO keeps category landing pages indexable and noindexes filter combinations", () => {
  assert.equal(shopPageShouldNoIndex(parseShopPageQuery({ category: "guitars" })), false);
  assert.equal(shopPageShouldNoIndex(parseShopPageQuery({ category: "guitars", type: "electric" })), true);
  assert.equal(shopPageShouldNoIndex(parseShopPageQuery({ offset: "24" })), true);
});
