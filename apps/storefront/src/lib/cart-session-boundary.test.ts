import assert from "node:assert/strict";
import test from "node:test";

import {
  validateCartResumeQuery,
  validateCartSessionBinding,
} from "./cart-session-boundary";

test("bind rejects a foreign cart when the session is already bound", () => {
  assert.deepEqual(
    validateCartSessionBinding("cart_foreign", "cart_owned"),
    {
      status: 403,
      body: { error: "Cart ownership could not be verified" },
    },
  );
});

test("bind establishes and repeats the same session cart", () => {
  assert.equal(validateCartSessionBinding("cart_owned", null).status, 200);
  assert.equal(validateCartSessionBinding("cart_owned", "cart_owned").status, 200);
});

test("resume rejects a foreign cart query", () => {
  assert.equal(validateCartResumeQuery("cart_foreign", "cart_owned"), false);
  assert.equal(validateCartResumeQuery("cart_owned", "cart_owned"), true);
  assert.equal(validateCartResumeQuery(null, "cart_owned"), true);
});
