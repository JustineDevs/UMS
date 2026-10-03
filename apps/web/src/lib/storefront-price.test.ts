import { strict as assert } from "node:assert";
import test from "node:test";
import { catalogAmountToStorefrontPrice } from "./storefront-price";

test("converts catalog centavos to storefront pesos", () => {
  assert.equal(catalogAmountToStorefrontPrice(1_099_900), 10_999);
  assert.equal(catalogAmountToStorefrontPrice(2_499_900), 24_999);
});
