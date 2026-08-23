import assert from "node:assert/strict";
import test from "node:test";
import { resolveShippingOptionId } from "./medusa-checkout-cart-prep";

test("shipping selection accepts the requested option", () => {
  assert.equal(
    resolveShippingOptionId([{ id: "standard" }, { id: "express" }], "express"),
    "express",
  );
});

test("shipping selection does not silently choose among multiple options", () => {
  assert.equal(resolveShippingOptionId([{ id: "standard" }, { id: "express" }]), null);
  assert.equal(resolveShippingOptionId([{ id: "standard" }], "stale"), "standard");
});
