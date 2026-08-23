import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderCancellationIdempotencyKey,
  isCancellableOrderStatus,
} from "./account-order-mutation";

test("cancellation status policy is fail-closed", () => {
  assert.equal(isCancellableOrderStatus("pending"), true);
  assert.equal(isCancellableOrderStatus("pending_payment"), true);
  assert.equal(isCancellableOrderStatus("requires_action"), true);
  assert.equal(isCancellableOrderStatus("paid"), false);
  assert.equal(isCancellableOrderStatus(undefined), false);
});

test("cancellation idempotency key is stable across email casing and whitespace", () => {
  assert.equal(
    buildOrderCancellationIdempotencyKey(" Buyer@example.com ", " order_123 "),
    buildOrderCancellationIdempotencyKey("buyer@example.com", "order_123"),
  );
});
