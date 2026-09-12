import assert from "node:assert/strict";
import test from "node:test";
import { countSellableCatalogRows } from "./medusa-store-sellable-count";

test("category counts use the same sellable population as product listings", () => {
  assert.equal(
    countSellableCatalogRows([
      { id: "unavailable", variants: [{ id: "v1", manage_inventory: true, inventory_quantity: 0 }] },
      { id: "available", variants: [{ id: "v2", manage_inventory: true, inventory_quantity: 2 }] },
      { id: "malformed", variants: [{ manage_inventory: true, inventory_quantity: 2 }] },
      { id: "unlimited", variants: [{ id: "v4", manage_inventory: false }] },
    ]),
    2,
  );
});
