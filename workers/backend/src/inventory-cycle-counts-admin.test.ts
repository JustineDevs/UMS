import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleInventoryCycleCountCollectionRequest, handleInventoryCycleCountDetailRequest } from "./inventory-cycle-counts-admin.ts";

function token(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff-1", exp: Math.floor(Date.now() / 1000) + 300, organization_id: "org-a", permissions: ["inventory:read"], ...claims });
  return `${header}.${payload}.${createHmac("sha256", "test-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

const countId = "8c4b85ee-4a78-4b9f-a41f-15a69df3221a";
const database: WorkerDatabaseClient = {
  async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string) {
    assert.match(sql, /organization_id=\$1/);
    return {
      rows: [{ id: countId, organization_id: "org-a", location_id: "loc-a", status: "open", revision: 1, inventory_cycle_count_lines: [], created_at: "2026-09-21T00:00:00.000Z" }] as T[],
      rowCount: 1,
    };
  },
  async end() {},
};

test("cycle count reads require inventory permission and stay tenant scoped", async () => {
  const response = await handleInventoryCycleCountCollectionRequest(
    new Request("https://worker.test/api/admin/inventory/cycle-counts?limit=500", { headers: { Authorization: `Bearer ${token()}` } }),
    database,
    undefined,
    { JWT_SECRET: "test-secret" },
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as { organizationId: string; data: Array<{ organization_id: string }> };
  assert.equal(payload.organizationId, "org-a");
  assert.equal(payload.data[0]?.organization_id, "org-a");
});

test("cycle count detail rejects unauthorized staff before database access", async () => {
  const untouched = { query: async () => { throw new Error("database must not be reached"); }, end: async () => {} } as unknown as WorkerDatabaseClient;
  const response = await handleInventoryCycleCountDetailRequest(
    new Request(`https://worker.test/api/admin/inventory/cycle-counts/${countId}`, { headers: { Authorization: `Bearer ${token({ permissions: ["content:read"] })}` } }),
    untouched,
    { JWT_SECRET: "test-secret" },
    countId,
  );
  assert.equal(response.status, 403);
});
