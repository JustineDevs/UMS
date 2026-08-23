import assert from "node:assert/strict";
import test from "node:test";
import { buildCartRestoreOperations } from "./cart-merge-recovery";

test("cart merge recovery restores changed, deleted, and newly-created lines", () => {
  assert.deepEqual(
    buildCartRestoreOperations(
      [
        { id: "line_a", variantId: "variant_a", quantity: 2 },
        { id: "line_b", variantId: "variant_b", quantity: 1 },
      ],
      [
        { id: "line_a", variantId: "variant_a", quantity: 5 },
        { id: "line_new", variantId: "variant_new", quantity: 1 },
      ],
    ),
    [
      { type: "update", lineId: "line_a", quantity: 2 },
      { type: "delete", lineId: "line_new" },
      { type: "create", variantId: "variant_b", quantity: 1 },
    ],
  );
});
