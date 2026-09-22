import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminPinApprovalRequest } from "./pin-approval-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", permissions: ["pos:use"], exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }
const employee = "00000000-0000-4000-8000-000000000001";

test("PIN approval rejects unauthenticated and malformed requests", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const unauthenticated = await handleAdminPinApprovalRequest(new Request("https://api.test/api/admin/pin-approval", { method: "POST" }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }); assert.equal(unauthenticated.status, 401);
  const malformed = await handleAdminPinApprovalRequest(new Request("https://api.test/api/admin/pin-approval", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ approver_employee_id: employee, pin: "bad" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }); assert.equal(malformed.status, 400);
});

test("PIN approval queries only the authenticated tenant and returns safe status", async () => {
  let query = ""; const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { query = text; return { rows: [{ role: "manager", pin_hash: null, is_active: true }], rowCount: 1 } as { rows: T[]; rowCount: number }; }, async end() {} };
  const response = await handleAdminPinApprovalRequest(new Request("https://api.test/api/admin/pin-approval", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ approver_employee_id: employee, pin: "1234", required_role: "manager" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { approved: false, reason: "no_pin_set" }); assert.ok(query.includes("organization_id=$2"));
});
