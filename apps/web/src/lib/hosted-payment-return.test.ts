import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHostedReturnMissingCorrelationMessage,
  buildHostedReturnStatusMessage,
  checkoutReviewHref,
  normalizeHostedReturnProvider,
  normalizeHostedReturnStatus,
  providerLabelForHostedReturn,
  sanitizeHostedCheckoutUrl,
} from "./hosted-payment-return";

test("normalizeHostedReturnProvider falls back to stripe", () => {
  assert.equal(normalizeHostedReturnProvider(undefined), "stripe");
  assert.equal(normalizeHostedReturnProvider("xendit"), "xendit");
  assert.equal(normalizeHostedReturnProvider("PAYPAL"), "paypal");
});

test("normalizeHostedReturnStatus defaults to success", () => {
  assert.equal(normalizeHostedReturnStatus(undefined), "success");
  assert.equal(normalizeHostedReturnStatus("cancel"), "cancel");
  assert.equal(normalizeHostedReturnStatus("failure"), "failure");
  assert.equal(normalizeHostedReturnStatus("canceled"), "cancel");
  assert.equal(normalizeHostedReturnStatus("expired"), "failure");
  assert.equal(normalizeHostedReturnStatus("failed"), "failure");
});

test("providerLabelForHostedReturn exposes user-facing labels", () => {
  assert.equal(providerLabelForHostedReturn("stripe"), "Stripe");
  assert.equal(providerLabelForHostedReturn("xendit"), "Xendit");
});

test("buildHostedReturn messages stay explicit and user-facing", () => {
  assert.match(
    buildHostedReturnMissingCorrelationMessage("xendit"),
    /Xendit/i,
  );
  assert.match(
    buildHostedReturnStatusMessage("paypal", "cancel"),
    /PayPal/i,
  );
  assert.match(
    buildHostedReturnStatusMessage("xendit", "failure"),
    /try again/i,
  );
});

test("checkoutReviewHref encodes the review message", () => {
  assert.equal(
    checkoutReviewHref("Payment failed & retry"),
    "/checkout?review=1&message=Payment%20failed%20%26%20retry",
  );
});

test("sanitizeHostedCheckoutUrl allows each provider's hosted checkout origin", () => {
  assert.match(
    sanitizeHostedCheckoutUrl("stripe", "https://checkout.stripe.com/c/pay/cs_test") ?? "",
    /^https:\/\/checkout\.stripe\.com\//,
  );
  assert.match(
    sanitizeHostedCheckoutUrl("paypal", "https://www.sandbox.paypal.com/checkoutnow?token=abc") ?? "",
    /^https:\/\/www\.sandbox\.paypal\.com\//,
  );
  assert.match(
    sanitizeHostedCheckoutUrl("xendit", "https://checkout.xendit.co/web/abc") ?? "",
    /^https:\/\/checkout\.xendit\.co\//,
  );
  assert.match(
    sanitizeHostedCheckoutUrl("xendit", "https://checkout-staging.xendit.co/session/abc") ?? "",
    /^https:\/\/checkout-staging\.xendit\.co\//,
  );
  assert.match(
    sanitizeHostedCheckoutUrl("xendit", "https://dev.xen.to/abc") ?? "",
    /^https:\/\/dev\.xen\.to\//,
  );
});

test("sanitizeHostedCheckoutUrl rejects an untrusted provider link", () => {
  assert.equal(
    sanitizeHostedCheckoutUrl("paypal", "https://evil.example/pay"),
    null,
  );
});
