import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("the former Medusa cart completion path remains an explicit tombstone", async () => {
  const response = await POST(
    new Request("https://shop.test/api/checkout/complete-medusa-cart", {
      method: "POST",
      headers: { origin: "https://shop.test" },
      body: "{}",
    }),
  );

  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  assert.deepEqual(await response.json(), {
    error:
      "Legacy cart completion is disabled. Use POST /api/payments/checkout-intents/:correlationId/finalize.",
    code: "LEGACY_ROUTE_DISABLED",
  });
});
