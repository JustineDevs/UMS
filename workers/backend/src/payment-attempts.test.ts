import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePaymentAttemptRegistrationRequest,
  handlePaymentAttemptRequest,
  handlePaymentAttemptRecoveryRequest,
} from "./payment-attempts.ts";

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

test("payment recovery requires a cart or attempt capability before querying", async () => {
  let queries = 0;
  const response = await handlePaymentAttemptRecoveryRequest(
    new Request("https://api.test/store/checkout-intents/recover?provider=stripe"),
    {
      query: async () => {
        queries += 1;
        return { rows: [], rowCount: 0 };
      },
      end: async () => undefined,
    },
  );
  assert.equal(response.status, 401);
  assert.equal(queries, 0);
});

test("payment recovery returns only an open attempt for the cookie-bound cart", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const response = await handlePaymentAttemptRecoveryRequest(
    new Request(
      "https://api.test/store/checkout-intents/recover?provider=paypal",
      { headers: { Cookie: "mcart_id=cart_1" } },
    ),
    {
      query: async <Row extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) => {
        queries.push({ text, values });
        return {
          rows: [
            {
              correlation_id: correlationId,
              cart_id: "cart_1",
              provider: "paypal",
              status: "pending_payment",
              checkout_state: "awaiting_provider",
              medusa_order_id: null,
            } as unknown as Row,
          ],
          rowCount: 1,
        };
      },
      end: async () => undefined,
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    found: true,
    correlationId,
    status: "pending_payment",
    checkoutState: "awaiting_provider",
    medusaOrderId: null,
  });
  assert.match(queries[0]?.text ?? "", /status = ANY\(\$3::text\[\]\)/);
  assert.match(queries[0]?.text ?? "", /ORDER BY created_at DESC LIMIT 1/);
  assert.deepEqual(queries[0]?.values, ["cart_1", "paypal", [
    "initiated",
    "pending_payment",
    "pending_capture",
    "paid",
    "authorized",
    "pending_provider_redirect",
    "paid_awaiting_order",
    "finalizing_order",
    "awaiting_completion",
    "needs_review",
  ]]);
});

test("payment recovery rejects unsupported providers and bounds provider order IDs", async () => {
  const unusedDatabase = {
    query: async () => {
      throw new Error("query should not run");
    },
    end: async () => undefined,
  };
  const badProvider = await handlePaymentAttemptRecoveryRequest(
    new Request("https://api.test/store/checkout-intents/recover?provider=cod", {
      headers: { Cookie: "mcart_id=cart_1" },
    }),
    unusedDatabase,
  );
  assert.equal(badProvider.status, 400);

  const oversizedOrderId = await handlePaymentAttemptRecoveryRequest(
    new Request(
      `https://api.test/store/checkout-intents/recover?provider=stripe&provider_order_id=${"x".repeat(501)}`,
      { headers: { Cookie: "mcart_id=cart_1" } },
    ),
    unusedDatabase,
  );
  assert.equal(oversizedOrderId.status, 400);
});

function checkoutDatabases() {
  const appQueries: Array<{ text: string; values: readonly unknown[] }> = [];
  const appDatabase = {
    query: async <Row extends Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ) => {
      appQueries.push({ text, values });
      return {
        rows: (text.includes("SELECT correlation_id, quote_fingerprint")
          ? []
          : []) as Row[],
        rowCount: text.startsWith("INSERT") ? 1 : null,
      };
    },
    end: async () => undefined,
  };
  const commerceDatabase = {
    query: async <Row extends Record<string, unknown>>(text: string) => ({
      rows: (text.includes("FROM public.cart c")
        ? [
            {
              cart_id: "cart_1",
              region_id: null,
              sales_channel_id: null,
              currency_code: "php",
              email: null,
              metadata: null,
              item_id: "line_1",
              title: "Product",
              quantity: 2,
              variant_id: "variant_1",
              product_id: "product_1",
              unit_price: 500,
              thumbnail: null,
              variant_title: null,
              product_handle: "product",
              variant_sku: null,
            },
          ]
        : [
            {
              variant_id: "variant_1",
              product_id: "product_1",
              title: "Product",
              status: "published",
              amount: 500,
              currency_code: "php",
            },
          ]) as Row[],
      rowCount: 1,
    }),
    end: async () => undefined,
  };
  return { appDatabase, commerceDatabase, appQueries };
}

async function expectedQuoteFingerprint() {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({
        validLines: [{ variantId: "variant_1", quantity: 2 }],
        subtotal: 1000,
        currency: "php",
      }),
    ),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

test("payment attempt registration requires the cart ownership cookie", async () => {
  const { appDatabase, commerceDatabase, appQueries } = checkoutDatabases();
  const response = await handlePaymentAttemptRegistrationRequest(
    new Request("https://api.test/store/checkout-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: "cart_1",
        provider: "cod",
        quoteFingerprint: await expectedQuoteFingerprint(),
      }),
    }),
    appDatabase,
    commerceDatabase,
  );
  assert.equal(response.status, 403);
  assert.equal(appQueries.length, 0);
});

test("payment attempt registration rejects a stale Worker-owned cart quote", async () => {
  const { appDatabase, commerceDatabase, appQueries } = checkoutDatabases();
  const response = await handlePaymentAttemptRegistrationRequest(
    new Request("https://api.test/store/checkout-intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "mcart_id=cart_1",
      },
      body: JSON.stringify({
        cartId: "cart_1",
        provider: "cod",
        quoteFingerprint: "a".repeat(64),
      }),
    }),
    appDatabase,
    commerceDatabase,
  );
  assert.equal(response.status, 409);
  assert.deepEqual(appQueries, []);
});

test("payment attempt registration persists a cart-bound authoritative quote", async () => {
  const { appDatabase, commerceDatabase, appQueries } = checkoutDatabases();
  const fingerprint = await expectedQuoteFingerprint();
  const response = await handlePaymentAttemptRegistrationRequest(
    new Request("https://api.test/store/checkout-intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "mcart_id=cart_1",
      },
      body: JSON.stringify({
        cartId: "cart_1",
        provider: "cod",
        quoteFingerprint: fingerprint,
        amountMinor: 1,
      }),
    }),
    appDatabase,
    commerceDatabase,
    { DEFAULT_ORGANIZATION_ID: "org_1" },
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.cartId, "cart_1");
  assert.equal(body.reused, false);
  assert.match(
    String(body.correlationId),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.match(
    response.headers.get("Set-Cookie") ?? "",
    /checkout_attempt_id=/,
  );
  const insert = appQueries.find(({ text }) => text.startsWith("INSERT"));
  assert.ok(insert);
  assert.equal(
    insert.values[4],
    1000,
    "amount is derived from Worker catalog pricing, not the client",
  );
  assert.equal(insert.values[6], fingerprint);
});
