import assert from "node:assert/strict";
import test from "node:test";

import { isMissingWorkerCartError } from "./cart-api-helpers";

test("only a confirmed missing Worker cart is eligible for cookie cleanup", () => {
  assert.equal(isMissingWorkerCartError(new Error("cart_not_found")), true);
  assert.equal(isMissingWorkerCartError(new Error("worker_cart_503")), false);
  assert.equal(isMissingWorkerCartError(new Error("network failure")), false);
  assert.equal(isMissingWorkerCartError("cart_not_found"), false);
});
