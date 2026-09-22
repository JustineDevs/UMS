import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminReconciliationRequest } from "./reconciliation-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }

test("reconciliation rejects unauthenticated and invalid query requests", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const unauthenticated = await handleAdminReconciliationRequest(new Request("https://api.test/api/admin/reconciliation"), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(unauthenticated.status, 401);
  const invalid = await handleAdminReconciliationRequest(new Request("https://api.test/api/admin/reconciliation?days=91", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(invalid.status, 400);
});

test("reconciliation uses tenant-scoped bounded projections", async () => {
  const queries: string[] = []; const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number }; }, async end() {} };
  const response = await handleAdminReconciliationRequest(new Request("https://api.test/api/admin/reconciliation?days=7&provider=stripe", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.ok(queries.every((query) => query.includes("organization_id=$1"))); assert.ok(queries.some((query) => query.includes("LIMIT 500"))); assert.ok(queries.some((query) => query.includes("LIMIT 25")));
});
