import assert from "node:assert/strict";
import test from "node:test";
import { handlePaymentAttemptRequest } from "./payment-attempts.ts";

const correlationId = "123e4567-e89b-12d3-a456-426614174000";

function database() {
  return {
    query: async <Row extends Record<string, unknown>>() => ({
      rows: [
        {
          correlation_id: correlationId,
          cart_id: "cart_1",
          provider: "stripe",
          provider_session_id: "cs_1",
          provider_payment_id: null,
          status: "paid",
          checkout_state: "provider_verified",
          quote_fingerprint: "quote_1",
          stale_reason: null,
          medusa_order_id: "order_1",
          last_error: "stripe provider timeout",
          finalize_attempts: 1,
          updated_at: "2026-09-11T00:00:00.000Z",
        } as unknown as Row,
      ],
      rowCount: 1,
    }),
    end: async () => undefined,
  };
}

test("returns a redacted, cookie-scoped payment attempt status", async () => {
  const response = await handlePaymentAttemptRequest(
    new Request("https://api.test/store/checkout-intents/" + correlationId, {
      headers: { Cookie: "mcart_id=cart_1" },
    }),
    database(),
    correlationId,
    {
      TRACKING_HMAC_SECRET: "tracking-secret",
      STOREFRONT_PUBLIC_URL: "https://store.test",
    },
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, "paid");
  assert.equal(body.providerSessionId, "cs_1");
  assert.equal(
    body.lastError,
    "Payment could not be verified. Try again or contact support.",
  );
  assert.match(
    String(body.trackingPageUrl),
    /^https:\/\/store\.test\/track\/cap_v3\./,
  );
});

test("does not expose payment attempts without the cart or attempt cookie", async () => {
  const response = await handlePaymentAttemptRequest(
    new Request("https://api.test/store/checkout-intents/" + correlationId),
    database(),
    correlationId,
  );
  assert.equal(response.status, 404);
});

test("rejects non-UUID attempt identifiers", async () => {
  const response = await handlePaymentAttemptRequest(
    new Request("https://api.test/store/checkout-intents/not-an-id"),
    database(),
    "not-an-id",
  );
  assert.equal(response.status, 400);
});
