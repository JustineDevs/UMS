import assert from "node:assert/strict";
import test from "node:test";
import { buildCartAbandonmentRecord } from "./cart-abandonment";

test("cart abandonment record strips client price authority", () => {
  const record = buildCartAbandonmentRecord({
    email: " Buyer@Example.test ",
    path: "/cart",
    lines: [{ variantId: "v1", quantity: 2, price: 999999, subtotal: 1999998 }],
    subtotal: 1999998,
  });

  assert.deepEqual(record, {
    email: "buyer@example.test",
    lineCount: 1,
    path: "/cart",
    referrer: null,
    clientTimestamp: null,
  });
  assert.equal("subtotal" in (record ?? {}), false);
  assert.equal("price" in (record ?? {}), false);
});
