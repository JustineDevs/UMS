import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { availableQuantityFromVariantRaw } from "./medusa-inventory-math.js";

describe("medusa-inventory-math", () => {
  it("sums available as stocked minus reserved", () => {
    const v = {
      inventory_items: [
        {
          inventory: {
            location_levels: [
              { stocked_quantity: 10, reserved_quantity: 3 },
              { stocked_quantity: 5, reserved_quantity: 5 },
            ],
          },
        },
      ],
    };
    assert.equal(availableQuantityFromVariantRaw(v), 7);
  });
});
