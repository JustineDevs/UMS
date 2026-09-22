import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminPosEnterpriseRequest } from "./pos-enterprise-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }

test("POS enterprise reads are tenant scoped and bounded", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number }; }, async end() {} };
  const response = await handleAdminPosEnterpriseRequest(new Request("https://api.test/api/admin/pos/enterprise", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.equal(queries.length, 3); assert.ok(queries.every((query) => query.includes("organization_id = $1") && query.includes("LIMIT $2") && !query.includes("SELECT *")));
});

test("POS enterprise writes require idempotency and validate control kind", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const response = await handleAdminPosEnterpriseRequest(new Request("https://api.test/api/admin/pos/enterprise", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "unknown" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 400);
  const missing = await handleAdminPosEnterpriseRequest(new Request("https://api.test/api/admin/pos/enterprise", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "fiscal" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
});
