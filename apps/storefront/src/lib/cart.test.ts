import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCartLines } from "./cart";

test("normalizeCartLines drops malformed rows and normalizes values", () => {
  const lines = normalizeCartLines([
    null,
    { variantId: "   ", quantity: 1 },
    {
      variantId: " variant_1 ",
      quantity: 2.9,
      slug: " guitar ",
      name: " Universal Guitar ",
      sku: " SKU-1 ",
      type: " M ",
      finish: " Black ",
      price: 300,
    },
  ]);

  assert.deepEqual(lines, [
    {
      variantId: "variant_1",
      quantity: 2,
      slug: "guitar",
      name: "Universal Guitar",
      sku: "SKU-1",
      type: "M",
      finish: "Black",
      price: 300,
    },
  ]);
});

test("normalizeCartLines merges duplicate variants into one normalized line", () => {
  const lines = normalizeCartLines([
    {
      variantId: "variant_1",
      quantity: 1,
      slug: "guitar",
      name: "Universal Guitar",
      sku: "SKU-1",
      type: "M",
      finish: "Black",
      price: 100,
    },
    {
      variantId: " variant_1 ",
      quantity: 3,
      slug: "guitar-v2",
      name: "Universal Guitar 2",
      sku: "SKU-1B",
      type: "L",
      finish: "Gray",
      price: 125,
    },
  ]);

  assert.deepEqual(lines, [
    {
      variantId: "variant_1",
      quantity: 4,
      slug: "guitar-v2",
      name: "Universal Guitar 2",
      sku: "SKU-1B",
      type: "L",
      finish: "Gray",
      price: 125,
    },
  ]);
});
