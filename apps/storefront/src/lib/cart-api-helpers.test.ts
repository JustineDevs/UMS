import assert from "node:assert/strict";
import test from "node:test";

import { isMedusaNotFoundError } from "./cart-api-helpers";

test("recognizes Medusa missing-cart responses by upstream status", () => {
  assert.equal(isMedusaNotFoundError({ status: 404 }), true);
  assert.equal(isMedusaNotFoundError({ status: 502 }), false);
  assert.equal(isMedusaNotFoundError(new Error("Not found")), false);
});
