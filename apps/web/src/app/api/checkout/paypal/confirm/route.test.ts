import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("PayPal confirmation is sent to the Worker with cookies and idempotency", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test/";
  let targetUrl = "";
  let targetInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    targetUrl = String(input);
    targetInit = init;
    return Response.json({ ok: true, correlationId: "corr-1", captureId: "capture-1" });
  }) as typeof fetch;
  try {
    const response = await POST(new Request("https://shop.test/api/checkout/paypal/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "checkout_attempt_id=corr-1",
      },
      body: JSON.stringify({ correlationId: "corr-1", orderId: "order-1" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(targetUrl, "https://worker.test/store/checkout/paypal/confirm");
    assert.equal(new Headers(targetInit?.headers).get("cookie"), "checkout_attempt_id=corr-1");
    assert.equal(new Headers(targetInit?.headers).get("idempotency-key"), "paypal-confirm:corr-1:order-1");
    assert.equal(targetInit?.redirect, "error");
    assert.deepEqual(await response.json(), {
      ok: true,
      provider: { ok: true, correlationId: "corr-1", captureId: "capture-1" },
    });
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});

test("PayPal confirmation reports a bounded error when the Worker is unreachable", async () => {
  const previousApiUrl = process.env.API_URL;
  const originalFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  globalThis.fetch = (async () => { throw new Error("private network detail"); }) as typeof fetch;
  try {
    const response = await POST(new Request("https://shop.test/api/checkout/paypal/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correlationId: "corr-1", orderId: "order-1" }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "PayPal confirmation service is unavailable" });
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
    globalThis.fetch = originalFetch;
  }
});
