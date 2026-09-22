import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handlePosDraftRequest, handlePosSaleRequest } from "./pos-admin.ts";

function database(): WorkerDatabaseClient {
  return { async query<T extends Record<string, unknown> = Record<string, unknown>>() { return { rows: [] as T[], rowCount: 0 }; }, async end() {} };
}

test("POS Worker contracts require staff authorization and tenant scope", async () => {
  const draft = await handlePosDraftRequest(new Request("https://worker.test/api/admin/pos/draft-order", { method: "POST", headers: { "Idempotency-Key": "pos-1" }, body: JSON.stringify({ items: [{ variantId: "v1", quantity: 1 }] }) }), database(), { JWT_SECRET: "secret" });
  assert.equal(draft.status, 401);
  const sale = await handlePosSaleRequest(new Request("https://worker.test/api/admin/pos/sales", { method: "POST", headers: { "Idempotency-Key": "pos-2" }, body: JSON.stringify({ items: [{ variantId: "v1", quantity: 1 }] }) }), database(), database(), { JWT_SECRET: "secret" });
  assert.equal(sale.status, 401);
});
