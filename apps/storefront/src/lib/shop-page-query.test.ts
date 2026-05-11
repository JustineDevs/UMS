import assert from "node:assert/strict";
import test from "node:test";

import { parseShopPageQuery } from "./shop-page-query";

test("parseShopPageQuery preserves valid filters when only price bounds are invalid", () => {
  const parsed = parseShopPageQuery({
    category: "shirts",
    sort: "price_asc",
    offset: "20",
    minPrice: "-1",
    maxPrice: "not-a-number",
  });

  assert.equal(parsed.category, "shirts");
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
