import assert from "node:assert/strict";
import test from "node:test";
import { handleCheckoutPreviewRequest } from "./checkout.ts";
import type { WorkerDatabaseClient } from "./database.ts";

test("checkout preview calculates authoritative persisted variant prices", async () => {
  const database: WorkerDatabaseClient = {
    async query() {
      return { rows: [{ variant_id: "variant_1", product_id: "product_1", title: "Canary", status: "published", amount: 599700, currency_code: "php" }], rowCount: 1 };
    },
    async end() {},
  };
  const response = await handleCheckoutPreviewRequest(new Request("https://api.test/store/checkout/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines: [{ variantId: "variant_1", quantity: 1 }] }),
  }), database);
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.total, 5997);
  assert.deepEqual(body.shippingOptions, []);
  assert.equal(body.taxTotal, 0);
});
