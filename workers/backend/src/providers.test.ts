import assert from "node:assert/strict";
import test from "node:test";
import {
  createPancakeOrder,
  createPayPalOrder,
  confirmPayPalOrder,
  createStripeCheckoutSession,
  createXenditSession,
  getXenditSession,
  refundStripePayment,
  refundPayPalCapture,
  refundXenditPayment,
} from "./providers.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("creates Stripe checkout with fetch, form encoding, and idempotency", async () => {
  let request: Request | undefined;
  const result = await createStripeCheckoutSession({
    secretKey: "sk_test_key",
    amountMinor: 599700,
    currency: "PHP",
    productName: "Canary",
    quantity: 1,
    successUrl: "https://store.test/success",
    cancelUrl: "https://store.test/cancel",
    idempotencyKey: "attempt-1",
    correlationId: "123e4567-e89b-12d3-a456-426614174000",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({
        id: "cs_test",
        url: "https://checkout.stripe.test",
      });
    },
  });
  assert.deepEqual(result, {
    id: "cs_test",
    url: "https://checkout.stripe.test",
  });
  assert.equal(request?.headers.get("Idempotency-Key"), "attempt-1");
  const stripeBody = await request!.text();
  assert.match(stripeBody, /line_items%5B0%5D%5Bquantity%5D=1/);
  assert.match(stripeBody, /metadata%5Bcorrelation_id%5D=123e4567/);
});

test("creates PayPal order through token and order fetch calls", async () => {
  const urls: string[] = [];
  const result = await createPayPalOrder({
    clientId: "client",
    clientSecret: "secret",
    sandbox: true,
    amountMajor: "5997.00",
    currency: "PHP",
    returnUrl: "https://store.test/return",
    cancelUrl: "https://store.test/cancel",
    idempotencyKey: "attempt-2",
    correlationId: "123e4567-e89b-12d3-a456-426614174000",
    fetcher: async (input) => {
      urls.push(String(input));
      return urls.length === 1
        ? jsonResponse({ access_token: "token" })
        : jsonResponse({
            id: "ORDER-1",
            links: [{ rel: "approve", href: "https://paypal.test/approve" }],
          });
    },
  });
  assert.deepEqual(result, {
    id: "ORDER-1",
    url: "https://paypal.test/approve",
  });
  assert.deepEqual(urls, [
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    "https://api-m.sandbox.paypal.com/v2/checkout/orders",
  ]);
});

test("confirms and captures a PayPal order only after matching completed capture", async () => {
  const urls: string[] = [];
  const result = await confirmPayPalOrder({
    clientId: "client",
    clientSecret: "secret",
    sandbox: true,
    orderId: "ORDER-2",
    expectedAmountMinor: 599700,
    expectedCurrency: "PHP",
    idempotencyKey: "attempt-5",
    fetcher: async (input) => {
      urls.push(String(input));
      if (urls.length === 1) return jsonResponse({ access_token: "token" });
      if (urls.length === 2) return jsonResponse({ status: "APPROVED", purchase_units: [] });
      return jsonResponse({
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ id: "CAPTURE-2", status: "COMPLETED", amount: { value: "5997.00", currency_code: "PHP" } }] } }],
      });
    },
  });
  assert.equal(result.captureId, "CAPTURE-2");
  assert.deepEqual(urls, [
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-2",
    "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-2/capture",
  ]);
});

test("verifies PayPal captures using the currency's actual minor-unit precision", async () => {
  for (const fixture of [
    { currency: "JPY", amountMinor: 1299, value: "1299" },
    { currency: "BHD", amountMinor: 1299, value: "1.299" },
  ]) {
    const result = await confirmPayPalOrder({
      clientId: "client",
      clientSecret: "secret",
      sandbox: true,
      orderId: `ORDER-${fixture.currency}`,
      expectedAmountMinor: fixture.amountMinor,
      expectedCurrency: fixture.currency,
      idempotencyKey: `confirm-${fixture.currency}`,
      fetcher: async (input) => {
        const url = String(input);
        if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "token" });
        if (url.endsWith(`/v2/checkout/orders/ORDER-${fixture.currency}`)) {
          return jsonResponse({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: `CAPTURE-${fixture.currency}`, status: "COMPLETED", amount: { value: fixture.value, currency_code: fixture.currency } }] } }] });
        }
        throw new Error(`unexpected PayPal call: ${url}`);
      },
    });
    assert.equal(result.captureId, `CAPTURE-${fixture.currency}`);
  }
});

test("creates Xendit payment link and Pancake order through fetch", async () => {
  const xendit = await createXenditSession({
    secretKey: "xnd_secret",
    referenceId: "order-1",
    amountMinor: 599700,
    currency: "PHP",
    successUrl: "https://store.test/success",
    cancelUrl: "https://store.test/cancel",
    idempotencyKey: "attempt-3",
    correlationId: "123e4567-e89b-12d3-a456-426614174000",
    fetcher: async () =>
      jsonResponse({
        payment_session_id: "session-1",
        payment_link_url: "https://xendit.test/pay",
      }),
  });
  const pancake = await createPancakeOrder({
    apiUrl: "https://pancake.test/api/v1",
    apiKey: "pancake-key",
    shopId: "shop-1",
    orderNumber: "ORDER-1",
    totalQuantity: 1,
    fetcher: async () => jsonResponse({ data: { order_id: "pancake-1" } }),
  });
  assert.deepEqual(xendit, { id: "session-1", url: "https://xendit.test/pay" });
  assert.deepEqual(pancake, { id: "pancake-1" });
});

test("retrieves the authoritative Xendit hosted-session state", async () => {
  let request: Request | undefined;
  const result = await getXenditSession({
    secretKey: "xnd_secret",
    sessionId: "session-1",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({
        id: "session-1",
        status: "COMPLETED",
        payment_id: "payment-1",
        payment_request_id: "request-1",
        amount: 599700,
        currency: "PHP",
      });
    },
  });
  assert.equal(request?.method, "GET");
  assert.equal(request?.url, "https://api.xendit.co/sessions/session-1");
  assert.match(request?.headers.get("Authorization") ?? "", /^Basic /);
  assert.deepEqual(result, {
    id: "session-1",
    status: "COMPLETED",
    paymentId: "payment-1",
    paymentRequestId: "request-1",
    amountMinor: 599700,
    currency: "PHP",
    payload: {
      id: "session-1",
      status: "COMPLETED",
      payment_id: "payment-1",
      payment_request_id: "request-1",
      amount: 599700,
      currency: "PHP",
    },
  });
});

test("keeps Xendit session failures fail-closed", async () => {
  await assert.rejects(
    getXenditSession({
      secretKey: "xnd_secret",
      sessionId: "session-1",
      fetcher: async () => jsonResponse({ error: "not_found" }, 404),
    }),
    /xendit_session_request_failed:404/,
  );
});

test("rejects failed provider responses instead of fabricating a checkout URL", async () => {
  await assert.rejects(
    createStripeCheckoutSession({
      secretKey: "sk_test_key",
      amountMinor: 1,
      currency: "PHP",
      productName: "x",
      quantity: 1,
      successUrl: "https://store.test/success",
      cancelUrl: "https://store.test/cancel",
      idempotencyKey: "attempt-4",
      fetcher: async () => jsonResponse({ error: "declined" }, 402),
    }),
    /stripe_request_failed:402/,
  );
});

test("creates a Stripe refund with an idempotent provider request", async () => {
  let request: Request | undefined;
  const result = await refundStripePayment({
    secretKey: "sk_test_key",
    paymentIntentId: "pi_test",
    amountMinor: 1200,
    idempotencyKey: "refund-1",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ id: "re_test", status: "succeeded" });
    },
  });
  assert.deepEqual(result, { id: "re_test", status: "succeeded" });
  assert.equal(request?.headers.get("Idempotency-Key"), "refund-1");
  assert.match(await request!.text(), /payment_intent=pi_test/);
});

test("refunds PayPal captures through sandbox OAuth and capture APIs", async () => {
  const urls: string[] = [];
  const result = await refundPayPalCapture({
    clientId: "client",
    clientSecret: "secret",
    sandbox: true,
    captureId: "CAPTURE-1",
    amountMajor: "12.00",
    currency: "PHP",
    idempotencyKey: "refund-2",
    fetcher: async (input) => {
      urls.push(String(input));
      return urls.length === 1
        ? jsonResponse({ access_token: "token" })
        : jsonResponse({ id: "REFUND-1", status: "COMPLETED" });
    },
  });
  assert.deepEqual(result, { id: "REFUND-1", status: "COMPLETED" });
  assert.deepEqual(urls, [
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-1/refund",
  ]);
});

test("creates an Xendit refund with the payment request identity", async () => {
  let request: Request | undefined;
  const result = await refundXenditPayment({
    secretKey: "xnd_test_key",
    paymentRequestId: "pr_test",
    amountMinor: 1200,
    currency: "PHP",
    idempotencyKey: "refund-3",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ refund_id: "refund_test", status: "SUCCEEDED" });
    },
  });
  assert.deepEqual(result, { id: "refund_test", status: "SUCCEEDED" });
  assert.equal(request?.headers.get("idempotency-key"), "refund-3");
  assert.match(await request!.text(), /payment_request_id/);
});
