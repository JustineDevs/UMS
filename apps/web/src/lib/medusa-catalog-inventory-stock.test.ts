import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableQuantityFromVariantRaw,
  stockedQuantityFromVariantRaw,
} from "./inventory-quantity-utils";

test("availableQuantityFromVariantRaw sums stocked minus reserved across levels", () => {
  const q = availableQuantityFromVariantRaw({
    inventory_items: [
      {
        inventory: {
          location_levels: [
            { stocked_quantity: 10, reserved_quantity: 2 },
            { stocked_quantity: 5, reserved_quantity: 0 },
          ],
        },
      },
    ],
  });
  assert.equal(q, 13);
});

test("availableQuantityFromVariantRaw returns 0 when no items", () => {
  assert.equal(availableQuantityFromVariantRaw({}), 0);
});

test("stockedQuantityFromVariantRaw sums stocked across levels", () => {
  const q = stockedQuantityFromVariantRaw({
    inventory_items: [
      {
        inventory: {
          location_levels: [
            { stocked_quantity: 10, reserved_quantity: 99 },
            { stocked_quantity: 3, reserved_quantity: 0 },
          ],
        },
      },
    ],
  });
  assert.equal(q, 13);
});

test("stockedQuantityFromVariantRaw returns 0 when no items", () => {
  assert.equal(stockedQuantityFromVariantRaw({}), 0);
});
