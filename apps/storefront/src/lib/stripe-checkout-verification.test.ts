import test from "node:test";
import assert from "node:assert/strict";
import { isPaidStripeCheckoutSession } from "./stripe-checkout-verification";

test("Stripe verification requires a complete paid session with matching quote", async () => {
  const result = await isPaidStripeCheckoutSession({
    sessionId: "cs_test_123",
    amountMinor: 214900,
    currency: "php",
    apiKey: "sk_test_key",
    fetchImpl: async () => new Response(JSON.stringify({
      amount_total: 214900,
      currency: "php",
      payment_status: "paid",
      status: "complete",
    }), { status: 200 }),
  });
  assert.equal(result, true);
});

test("Stripe verification fails closed for mismatched or incomplete sessions", async () => {
  const result = await isPaidStripeCheckoutSession({
    sessionId: "cs_test_123",
    amountMinor: 214900,
    currency: "php",
    apiKey: "sk_test_key",
    fetchImpl: async () => new Response(JSON.stringify({
      amount_total: 214900,
      currency: "php",
      payment_status: "unpaid",
      status: "open",
    }), { status: 200 }),
  });
  assert.equal(result, false);
});
