import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminPaymentRetryRequest } from "./payment-retry-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }
const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };

test("payment retry rejects unauthenticated and non-idempotent requests", async () => {
  const unauthenticated = await handleAdminPaymentRetryRequest(new Request("https://api.test/api/admin/payments/00000000-0000-4000-8000-000000000001/retry", { method: "POST" }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_1");
  assert.equal(unauthenticated.status, 401);
  const missingKey = await handleAdminPaymentRetryRequest(new Request("https://api.test/api/admin/payments/00000000-0000-4000-8000-000000000001/retry", { method: "POST", headers: { Authorization: `Bearer ${token()}` } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_2");
  assert.equal(missingKey.status, 400);
});

test("payment retry validates the correlation identifier before opening database work", async () => {
  const response = await handleAdminPaymentRetryRequest(new Request("https://api.test/api/admin/payments/not-a-uuid/retry", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "retry-1" } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_3");
  assert.equal(response.status, 400);
});
