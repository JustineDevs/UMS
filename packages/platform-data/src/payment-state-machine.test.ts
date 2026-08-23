import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPaymentCheckoutTransition,
  isPaymentCheckoutState,
} from "./payment-state-machine.js";

test("payment checkout state machine permits the normal provider-to-order path", () => {
  assert.doesNotThrow(() => assertPaymentCheckoutTransition("awaiting_provider", "provider_verified"));
  assert.doesNotThrow(() => assertPaymentCheckoutTransition("provider_verified", "finalizing_order"));
  assert.doesNotThrow(() => assertPaymentCheckoutTransition("finalizing_order", "completed"));
});

test("payment checkout state machine rejects terminal regression", () => {
  assert.throws(
    () => assertPaymentCheckoutTransition("completed", "awaiting_provider"),
    /Invalid payment checkout transition/,
  );
});

test("unknown legacy states remain readable without bypassing known-state transitions", () => {
  assert.equal(isPaymentCheckoutState("awaiting_provider"), true);
  assert.equal(isPaymentCheckoutState("legacy_state"), false);
  assert.doesNotThrow(() => assertPaymentCheckoutTransition("legacy_state", "awaiting_provider"));
});
