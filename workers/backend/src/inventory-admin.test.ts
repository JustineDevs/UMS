import assert from "node:assert/strict";
import test from "node:test";
import { handleInventoryAdjustmentRequest } from "./inventory-admin.ts";

test("inventory adjustment requires a verified staff bearer token", async () => {
  const response = await handleInventoryAdjustmentRequest(
    new Request("https://worker.test/api/admin/inventory", { method: "POST", headers: { "Idempotency-Key": "inventory-1" }, body: JSON.stringify({ productId: "p", variantId: "v", delta: 1 }) }),
    { query: async () => ({ rows: [], rowCount: 0 }) } as never,
    { JWT_SECRET: "test" },
  );
  assert.equal(response.status, 403);
});
