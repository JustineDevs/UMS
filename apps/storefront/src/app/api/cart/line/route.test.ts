import assert from "node:assert/strict";
import test from "node:test";

import { findMatchingCartLineIds } from "@/lib/cart-line-matching";

test("server cart removal targets every matching variant line and ignores malformed items", () => {
  assert.deepEqual(
    findMatchingCartLineIds(
      [
        { id: "line_1", variant_id: "variant_1" },
        { id: "line_2", variant_id: "variant_2" },
        { id: "line_3", variant_id: "variant_1" },
        { id: 42, variant_id: "variant_1" },
        null,
      ],
      "variant_1",
    ),
    ["line_1", "line_3"],
  );
});
