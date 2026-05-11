import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHostedReturnMissingCorrelationMessage,
  buildHostedReturnStatusMessage,
  checkoutReviewHref,
  normalizeHostedReturnProvider,
  normalizeHostedReturnStatus,
  providerLabelForHostedReturn,
} from "./hosted-payment-return";

test("normalizeHostedReturnProvider falls back to stripe", () => {
  assert.equal(normalizeHostedReturnProvider(undefined), "stripe");
  assert.equal(normalizeHostedReturnProvider("maya"), "maya");
  assert.equal(normalizeHostedReturnProvider("PAYPAL"), "paypal");
});

test("normalizeHostedReturnStatus defaults to success", () => {
  assert.equal(normalizeHostedReturnStatus(undefined), "success");
  assert.equal(normalizeHostedReturnStatus("cancel"), "cancel");
  assert.equal(normalizeHostedReturnStatus("failure"), "failure");
});

test("providerLabelForHostedReturn exposes user-facing labels", () => {
  assert.equal(providerLabelForHostedReturn("stripe"), "Stripe");
  assert.equal(providerLabelForHostedReturn("paymongo"), "PayMongo");
});

test("buildHostedReturn messages stay explicit and user-facing", () => {
  assert.match(
    buildHostedReturnMissingCorrelationMessage("maya"),
    /Maya payment/i,
  );
  assert.match(
    buildHostedReturnStatusMessage("paypal", "cancel"),
    /PayPal/i,
  );
  assert.match(
    buildHostedReturnStatusMessage("paymongo", "failure"),
    /try again/i,
  );
});

test("checkoutReviewHref encodes the review message", () => {
  assert.equal(
    checkoutReviewHref("Payment failed & retry"),
    "/checkout?review=1&message=Payment%20failed%20%26%20retry",
  );
});
