import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutAttemptCookie,
  handleCheckoutSessionRequest,
  readCheckoutTotals,
} from "./checkout.ts";

test("creates a secure, short-lived attempt cookie for status handoff", () => {
  const cookie = checkoutAttemptCookie("8f7d7c0e-3bd2-4b42-a3dc-2df16c6f62a1");
  assert.match(
    cookie,
    /^checkout_attempt_id=8f7d7c0e-3bd2-4b42-a3dc-2df16c6f62a1;/,
  );
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=900/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test("calculates checkout totals from persisted line prices", async () => {
  const totals = await readCheckoutTotals("cart-1", {
    async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
      return {
        rows: [
          {
            cart_id: "cart-1",
            currency_code: "php",
            quantity: 2,
            unit_price: 5997,
          },
          {
            cart_id: "cart-1",
            currency_code: "php",
            quantity: 1,
            unit_price: "900",
          },
        ] as Row[],
        rowCount: 2,
      };
    },
    async end(): Promise<void> {},
  });
  assert.deepEqual(totals, { currency: "php", amountMinor: 12_894 });
});

test("does not create a checkout for an empty cart", async () => {
  const totals = await readCheckoutTotals("cart-empty", {
    async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
      return { rows: [], rowCount: 0 };
    },
    async end(): Promise<void> {},
  });
  assert.equal(totals, null);
});

test("rejects non-HTTPS checkout callbacks before database or provider work", async () => {
  const response = await handleCheckoutSessionRequest(
    new Request("https://api.test/store/checkout/session", {
      method: "POST",
      headers: { "Idempotency-Key": "checkout-unsafe" },
      body: JSON.stringify({
        cart_id: "cart-1",
        provider: "stripe",
        success_url: "http://evil.test/success",
        cancel_url: "https://shop.test/cancel",
      }),
    }),
    {
      query: async () => {
        throw new Error("database must not be queried");
      },
      end: async () => undefined,
    },
    {},
  );
  assert.equal(response.status, 400);
  assert.equal(
    ((await response.json()) as { error: string }).error,
    "invalid_checkout_urls",
  );
});
