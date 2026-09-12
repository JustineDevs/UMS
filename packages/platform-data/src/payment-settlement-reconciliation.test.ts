import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSettlement } from "./payment-settlement-reconciliation.js";

const base = {
  providerExternalId: "txn_1",
  providerPaymentExternalId: "pay_1",
  expectedPaymentExternalId: "pay_1",
  expectedOrderId: "order_1",
  providerOrderId: "order_1",
  expectedAmountMinor: 1000,
  providerAmountMinor: 1000,
  expectedCurrency: "PHP",
  providerCurrency: "php",
  providerStatus: "succeeded",
};

test("settlement matches only when provider, order, payment, amount, currency, and status agree", () => {
  assert.deepEqual(reconcileSettlement(base), { status: "matched", mismatchReason: null });
  assert.equal(reconcileSettlement({ ...base, providerAmountMinor: 999 }).status, "discrepancy");
  assert.equal(reconcileSettlement({ ...base, providerOrderId: "order_other" }).mismatchReason, "order_reference_mismatch");
  assert.equal(reconcileSettlement({ ...base, providerStatus: "pending" }).status, "needs_review");
});
