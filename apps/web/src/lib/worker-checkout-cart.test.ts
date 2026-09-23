import assert from "node:assert/strict";
import test from "node:test";

import { createWorkerCheckoutCart } from "./worker-checkout-cart";

test("checkout cart creation derives stable keys for replayed cart and line writes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; key: string | null }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({
      url: String(input),
      key: new Headers(init?.headers).get("Idempotency-Key"),
    });
    return new Response(
      String(input).endsWith("/store/carts")
        ? JSON.stringify({ cart: { id: "cart_replayable" } })
        : JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const lines = [
      { variantId: "variant_1", quantity: 1 },
      { variantId: "variant_2", quantity: 2 },
    ];
    await createWorkerCheckoutCart("https://worker.test", lines, "checkout-attempt-1");
    await createWorkerCheckoutCart("https://worker.test", lines, "checkout-attempt-1");
    assert.deepEqual(
      requests.map((request) => request.key),
      [
        "checkout-attempt-1-cart",
        "checkout-attempt-1-line-0",
        "checkout-attempt-1-line-1",
        "checkout-attempt-1-cart",
        "checkout-attempt-1-line-0",
        "checkout-attempt-1-line-1",
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
