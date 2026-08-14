import test from "node:test";
import assert from "node:assert/strict";
import {
  orderQualifiesForVerifiedPurchase,
} from "./medusa-review-verification";

test("orderQualifiesForVerifiedPurchase accepts captured payment", () => {
  assert.equal(
    orderQualifiesForVerifiedPurchase({
      status: "pending",
      payment_status: "captured",
    }),
    true,
  );
});

test("orderQualifiesForVerifiedPurchase accepts completed status with captured payment", () => {
  assert.equal(
    orderQualifiesForVerifiedPurchase({
      status: "completed",
      payment_status: "captured",
    }),
    true,
  );
});

test("orderQualifiesForVerifiedPurchase rejects not_paid when order not completed", () => {
  assert.equal(
    orderQualifiesForVerifiedPurchase({
      status: "pending",
      payment_status: "not_paid",
    }),
    false,
  );
});

test("orderQualifiesForVerifiedPurchase accepts completed even if payment_status is not_paid", () => {
  assert.equal(
    orderQualifiesForVerifiedPurchase({
      status: "completed",
      payment_status: "not_paid",
    }),
    true,
  );
});

test("orderQualifiesForVerifiedPurchase rejects awaiting payment", () => {
  assert.equal(
    orderQualifiesForVerifiedPurchase({
      status: "pending",
      payment_status: "awaiting",
    }),
    false,
  );
});
