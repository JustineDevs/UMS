import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminVoidsRequest } from "./voids-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }
const auth = { Authorization: `Bearer ${token()}` };

test("void reads are tenant scoped and bounded", async () => {
  let query = ""; const database: WorkerDatabaseClient = { async query(text: string, values: readonly unknown[]) { query = text; assert.deepEqual(values, ["org_1", 50]); return { rows: [], rowCount: 0 }; }, async end() {} };
  const response = await handleAdminVoidsRequest(new Request("https://api.test/api/admin/voids?limit=50", { headers: auth }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.ok(query.includes("organization_id=$1") && query.includes("LIMIT $2") && !query.includes("SELECT *"));
});

test("void writes require idempotency and reject invalid employee identifiers", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const response = await handleAdminVoidsRequest(new Request("https://api.test/api/admin/voids", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ employee_id: "not-a-uuid", action: "void_item" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 400);
});
