import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateReturnableOrderStatus,
  normalizeReturnRequestLines,
  validateReturnRequestLines,
} from "./account-return-policy";

test("return policy allows only post-payment fulfillment states", () => {
  for (const status of [
    "completed",
    "fulfilled",
    "partially_fulfilled",
    "shipped",
    "delivered",
  ]) {
    assert.deepEqual(evaluateReturnableOrderStatus(status), {
      ok: true,
      status,
    });
  }
});

test("return policy rejects cancelled, expired, pre-payment, and unknown states", () => {
  for (const status of [
    "cancelled",
    "canceled",
    "expired",
    "pending",
    "draft",
    "mystery",
  ]) {
    const result = evaluateReturnableOrderStatus(status);
    assert.equal(result.ok, false);
  }
  assert.deepEqual(evaluateReturnableOrderStatus(undefined), {
    ok: false,
    reason: "unknown_status",
    status: "unknown",
  });
});

test("return requests are limited to fresh order-line quantities", () => {
  const lines = [{ id: "item_1", quantity: 3, returned_quantity: 1 }];
  assert.deepEqual(
    validateReturnRequestLines([{ item_id: "item_1", quantity: 2 }], lines),
    { ok: true },
  );
  assert.deepEqual(
    validateReturnRequestLines([{ item_id: "item_1", quantity: 3 }], lines),
    { ok: false, reason: "quantity_exceeds_available" },
  );
  assert.deepEqual(
    validateReturnRequestLines([{ item_id: "item_2", quantity: 1 }], lines),
    { ok: false, reason: "unknown_item" },
  );
});

test("return line normalization makes equivalent payloads replayable", () => {
  assert.deepEqual(
    normalizeReturnRequestLines([
      { item_id: "item_2", quantity: 1 },
      { item_id: "item_1", quantity: 2 },
    ]),
    [
      { item_id: "item_1", quantity: 2 },
      { item_id: "item_2", quantity: 1 },
    ],
  );
});
