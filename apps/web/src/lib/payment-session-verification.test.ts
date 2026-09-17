import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedMedusaPaymentSession } from "./payment-session-verification";

test("payment session verification requires matching amount, currency, and authorized state", () => {
  const session = { amount: 12500, currency_code: "php", status: "captured" };
  assert.equal(isAuthorizedMedusaPaymentSession(session, { amount_minor: 12500, currency: "PHP" }), true);
  assert.equal(isAuthorizedMedusaPaymentSession(session, { amount_minor: 12501, currency: "PHP" }), false);
  assert.equal(isAuthorizedMedusaPaymentSession(session, { amount_minor: 12500, currency: "USD" }), false);
  assert.equal(isAuthorizedMedusaPaymentSession({ ...session, status: "pending" }, { amount_minor: 12500, currency: "PHP" }), false);
});
