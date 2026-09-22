import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("payment recovery fails closed when the Worker API is not configured", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  delete process.env.API_URL;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response();
  }) as typeof fetch;
  try {
    const response = await GET(new Request("https://shop.test/api/payments/recover"));
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});

test("payment recovery forwards provider, provider order ID, and capability cookie to Worker", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test/";
  let targetUrl = "";
  let targetInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    targetUrl = String(input);
    targetInit = init;
    return Response.json({ found: false });
  }) as typeof fetch;
  try {
    const response = await GET(new Request(
      "https://shop.test/api/payments/recover?provider=paypal&provider_order_id=order-123",
      { headers: { cookie: "mcart_id=cart-1" } },
    ));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { found: false });
    assert.equal(
      targetUrl,
      "https://worker.test/store/checkout-intents/recover?provider=paypal&provider_order_id=order-123",
    );
    assert.equal(new Headers(targetInit?.headers).get("cookie"), "mcart_id=cart-1");
    assert.equal(targetInit?.cache, "no-store");
    assert.equal(targetInit?.redirect, "error");
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});

test("payment recovery reports a bounded error when the Worker is unreachable", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  globalThis.fetch = (async () => { throw new Error("private network detail"); }) as typeof fetch;
  try {
    const response = await GET(new Request("https://shop.test/api/payments/recover?provider=stripe"));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Payment service is unavailable" });
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});
