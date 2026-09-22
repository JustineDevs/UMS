import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./[correlationId]/route";

const context = { params: Promise.resolve({ correlationId: "corr-1" }) };

test("payment attempt status fails closed without the Worker API", async () => {
  const previousApiUrl = process.env.API_URL;
  delete process.env.API_URL;
  try {
    const response = await GET(new Request("https://shop.test/api/payment-status"), context);
    assert.equal(response.status, 503);
  } finally {
    if (previousApiUrl !== undefined) process.env.API_URL = previousApiUrl;
  }
});

test("payment attempt status validates and returns the Worker contract", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test/";
  let targetUrl = "";
  let targetInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    targetUrl = String(input);
    targetInit = init;
    return Response.json({
      correlationId: "corr-1",
      cartId: "cart-1",
      provider: "stripe",
      status: "paid",
      checkoutState: "provider_verified",
      trackingPageUrl: null,
      lastError: null,
      finalizeAttempts: 0,
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
  }) as typeof fetch;
  try {
    const response = await GET(
      new Request("https://shop.test/api/payment-status", {
        headers: { cookie: "checkout_attempt_id=corr-1" },
      }),
      context,
    );
    assert.equal(response.status, 200);
    assert.equal(targetUrl, "https://worker.test/store/checkout-intents/corr-1");
    assert.equal(new Headers(targetInit?.headers).get("cookie"), "checkout_attempt_id=corr-1");
    assert.equal(targetInit?.redirect, "error");
    assert.equal((await response.json() as { status: string }).status, "paid");
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});

test("payment attempt status reports a bounded error when the Worker is unreachable", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  globalThis.fetch = (async () => { throw new Error("private network detail"); }) as typeof fetch;
  try {
    const response = await GET(new Request("https://shop.test/api/payment-status"), context);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Payment service is unavailable" });
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});
