import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminCmsRedirectsRequest } from "./cms-redirects-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }
const row = { id: "00000000-0000-0000-0000-000000000001", from_path: "/old", to_path: "/new", status_code: 301, active: true, preserve_query: false, created_at: "2026-01-01" };

test("CMS redirects are tenant-scoped, bounded, and explicitly projected", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [row] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleAdminCmsRedirectsRequest(new Request("https://api.test/api/admin/cms/redirects" , { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0]?.values, ["org_1", 5000]);
  assert.ok(queries[0]?.text.includes("organization_id = $1") && !queries[0]?.text.includes("SELECT *"));
});

test("CMS redirect writes require idempotency and reject unsafe external targets", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { if (text.includes("worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }] as unknown as T[], rowCount: 1 }; return { rows: [row] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const invalid = await handleAdminCmsRedirectsRequest(new Request("https://api.test/api/admin/cms/redirects", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "redirect-1", "Content-Type": "application/json" }, body: JSON.stringify({ from_path: "/old", to_path: "//evil.example" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(invalid.status, 400);
  const missing = await handleAdminCmsRedirectsRequest(new Request("https://api.test/api/admin/cms/redirects", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ from_path: "/old", to_path: "/new" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
});
