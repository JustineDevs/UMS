import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminStorefrontHomeRequest } from "./storefront-home-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }

test("storefront home reads the global content projection without SELECT *", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [{ payload: { hero: { title: "Home" } }, updated_at: "2026-01-01" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleAdminStorefrontHomeRequest(new Request("https://api.test/api/admin/storefront-home", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.equal(queries.length, 1); assert.ok(queries[0]?.text.includes("WHERE id = $1") && !queries[0]?.text.includes("SELECT *"));
});

test("storefront home writes require idempotency and bound payloads", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "claimed" }] as unknown as T[], rowCount: 1 }; if (text.includes("DELETE FROM public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const base = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
  const missing = await handleAdminStorefrontHomeRequest(new Request("https://api.test/api/admin/storefront-home", { method: "PUT", headers: base, body: "{}" }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const response = await handleAdminStorefrontHomeRequest(new Request("https://api.test/api/admin/storefront-home", { method: "PUT", headers: { ...base, "Idempotency-Key": "home-1" }, body: JSON.stringify({ hero: { title: "Home" } }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
});
