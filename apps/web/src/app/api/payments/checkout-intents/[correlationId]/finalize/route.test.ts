import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "./route";

const context = { params: Promise.resolve({ correlationId: "corr-123" }) };

test("checkout finalize rejects cross-site mutations before contacting the Worker", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response();
  }) as typeof fetch;
  try {
    const response = await POST(
      new Request("https://shop.test/api/payments/finalize", {
        method: "POST",
        headers: { origin: "https://attacker.test", "sec-fetch-site": "cross-site" },
      }),
      context,
    );
    assert.equal(response.status, 403);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout finalize fails closed when the Worker API is not configured", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  let called = false;
  delete process.env.API_URL;
  globalThis.fetch = (async () => {
    called = true;
    return new Response();
  }) as typeof fetch;
  try {
    const response = await POST(
      new Request("https://shop.test/api/payments/finalize", { method: "POST" }),
      context,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Checkout service is unavailable" });
    assert.equal(called, false);
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});

test("checkout finalize proxies to the Worker without following redirects", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  let targetUrl = "";
  let targetInit: RequestInit | undefined;
  process.env.API_URL = "https://worker.test/";
  globalThis.fetch = (async (input, init) => {
    targetUrl = String(input);
    targetInit = init;
    return new Response(JSON.stringify({
      orderId: "order_123",
      redirectUrl: "https://shop.test/track/cap_signed-token",
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const response = await POST(
      new Request("https://shop.test/api/payments/finalize", {
        method: "POST",
        headers: { cookie: "checkout_attempt_id=corr-123" },
      }),
      context,
    );
    assert.equal(response.status, 201);
    assert.equal(targetUrl, "https://worker.test/store/checkout-intents/corr-123/finalize");
    assert.equal(targetInit?.method, "POST");
    assert.equal(targetInit?.redirect, "error");
    assert.equal(new Headers(targetInit?.headers).get("cookie"), "checkout_attempt_id=corr-123");
    assert.deepEqual(await response.json(), {
      orderId: "order_123",
      redirectUrl: "https://shop.test/track/cap_signed-token",
    });
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});
