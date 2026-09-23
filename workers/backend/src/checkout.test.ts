import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutAttemptCookie,
  handleCheckoutPreviewRequest,
  handleCheckoutSessionRequest,
  readCheckoutTotals,
} from "./checkout.ts";
import { formatMajorAmount, majorToMinor, minorToMajor } from "./money.ts";

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

test("converts zero-, two-, and three-decimal currencies consistently", () => {
  assert.equal(minorToMajor(1_299, "JPY"), 1_299);
  assert.equal(majorToMinor(1_299, "JPY"), 1_299);
  assert.equal(formatMajorAmount(1_299, "JPY"), "1299");

  assert.equal(minorToMajor(1_299, "PHP"), 12.99);
  assert.equal(majorToMinor(12.99, "PHP"), 1_299);
  assert.equal(formatMajorAmount(1_299, "PHP"), "12.99");

  assert.equal(minorToMajor(1_299, "BHD"), 1.299);
  assert.equal(majorToMinor(1.299, "BHD"), 1_299);
  assert.equal(formatMajorAmount(1_299, "BHD"), "1.299");
});

test("checkout preview expresses persisted minor-unit prices in currency major units", async () => {
  for (const [currency, amountMinor, expectedTotal] of [
    ["jpy", 1_299, 1_299],
    ["php", 1_299, 12.99],
    ["bhd", 1_299, 1.299],
  ] as const) {
    const response = await handleCheckoutPreviewRequest(
      new Request("https://worker.test/store/checkout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: [{ variantId: "variant-1", quantity: 1 }] }),
      }),
      {
        async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
          return {
            rows: [
              {
                variant_id: "variant-1",
                product_id: "product-1",
                title: "Instrument",
                status: "published",
                amount: amountMinor,
                currency_code: currency,
              },
            ] as Row[],
            rowCount: 1,
          };
        },
        async end(): Promise<void> {},
      },
    );

    assert.equal(response.status, 200);
    const preview = (await response.json()) as {
      total: number;
      subtotal: number;
      lineSubtotalsByVariantId: Record<string, number>;
      currencyCode: string;
    };
    assert.equal(preview.total, expectedTotal);
    assert.equal(preview.subtotal, expectedTotal);
    assert.equal(preview.lineSubtotalsByVariantId["variant-1"], expectedTotal);
    assert.equal(preview.currencyCode, currency.toUpperCase());
  }
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

test("accepts loopback HTTP callbacks for local checkout runs", async () => {
  const response = await handleCheckoutSessionRequest(
    new Request("http://127.0.0.1/store/checkout/session", {
      method: "POST",
      headers: { "Idempotency-Key": "checkout-local-loopback" },
      body: JSON.stringify({
        cart_id: "cart-1",
        provider: "stripe",
        success_url: "http://localhost:3000/checkout/hosted-return?provider=stripe",
        cancel_url: "http://localhost:3000/checkout/hosted-return?provider=stripe&status=cancel",
      }),
    }),
    {
      query: async (sql: string) => {
        if (sql.includes("FROM public.cart c")) {
          return {
            rows: [{ cart_id: "cart-1", currency_code: "PHP", quantity: 1, unit_price: 100 }],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
          return { rows: [{ state: "pending", request_hash: "" }], rowCount: 1 };
        }
        if (sql.includes("DELETE FROM public.worker_idempotency_records")) {
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`unexpected query: ${sql}`);
      },
      end: async () => undefined,
    },
    { STRIPE_API_KEY: "" },
  );
  assert.equal(response.status, 502);
  assert.equal(
    ((await response.json()) as { error: string }).error,
    "checkout_provider_failed",
  );
});

test("explains Xendit's HTTPS callback requirement before provider work", async () => {
  const response = await handleCheckoutSessionRequest(
    new Request("http://127.0.0.1/store/checkout/session", {
      method: "POST",
      headers: { "Idempotency-Key": "checkout-xendit-local-callback" },
      body: JSON.stringify({
        cart_id: "cart-1",
        provider: "xendit",
        success_url:
          "http://localhost:3000/checkout/hosted-return?provider=xendit&status=success",
        cancel_url:
          "http://localhost:3000/checkout/hosted-return?provider=xendit&status=cancel",
      }),
    }),
    {
      query: async () => {
        throw new Error("database must not be queried");
      },
      end: async () => undefined,
    },
    { XENDIT_SECRET_KEY: "sandbox-key" },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error:
      "Xendit requires an authenticated HTTPS callback URL for hosted checkout.",
    code: "XENDIT_HTTPS_CALLBACK_REQUIRED",
  });
});
