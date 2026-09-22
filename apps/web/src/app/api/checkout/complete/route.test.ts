import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("legacy checkout completion stays disabled even if the old opt-in is set", async () => {
  const previousFlag = process.env.STOREFRONT_LEGACY_CART_COMPLETION_ALLOW;
  const originalFetch = globalThis.fetch;
  process.env.STOREFRONT_LEGACY_CART_COMPLETION_ALLOW = "true";
  let workerCalled = false;
  globalThis.fetch = (async () => {
    workerCalled = true;
    return new Response("unexpected", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await POST(
      new Request("https://shop.test/api/checkout/complete", {
        method: "POST",
        headers: { origin: "https://shop.test" },
        body: JSON.stringify({ correlationId: "attempt-1" }),
      }),
    );

    assert.equal(response.status, 410);
    assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
    assert.deepEqual(await response.json(), {
      error:
        "Legacy cart completion is disabled. Use POST /api/payments/checkout-intents/:correlationId/finalize.",
      code: "LEGACY_ROUTE_DISABLED",
    });
    assert.equal(workerCalled, false);
  } finally {
    if (previousFlag === undefined) delete process.env.STOREFRONT_LEGACY_CART_COMPLETION_ALLOW;
    else process.env.STOREFRONT_LEGACY_CART_COMPLETION_ALLOW = previousFlag;
    globalThis.fetch = originalFetch;
  }
});

test("legacy checkout completion rejects cross-site mutations", async () => {
  const response = await POST(
    new Request("https://shop.test/api/checkout/complete", {
      method: "POST",
      headers: {
        origin: "https://attacker.test",
        "sec-fetch-site": "cross-site",
      },
      body: "{}",
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Cross-site mutation rejected" });
});
