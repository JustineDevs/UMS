import assert from "node:assert/strict";
import test from "node:test";
import { publicPaymentAttemptError } from "./payment-attempt-public";
import { matchesProviderOrderId } from "./payment-intent-recovery";

test("provider recovery never accepts an unrelated payment attempt", () => {
  assert.equal(
    matchesProviderOrderId({ provider_payment_id: "paypal-order-1" }, "paypal-order-2"),
    false,
  );
  assert.equal(
    matchesProviderOrderId({ provider_session_id: "paypal-order-2" }, "paypal-order-2"),
    true,
  );
});

test("public payment errors are stable and do not expose provider details", () => {
  assert.equal(
    publicPaymentAttemptError("Stripe secret key rejected for account abc"),
    "Payment could not be verified. Try again or contact support.",
  );
  assert.equal(
    publicPaymentAttemptError("Medusa order completion timed out"),
    "Your order is still being finalized. Try again shortly.",
  );
});

test("empty payment errors remain absent", () => {
  assert.equal(publicPaymentAttemptError(null), null);
  assert.equal(publicPaymentAttemptError("   "), null);
});
