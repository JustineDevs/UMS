import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminCmsFormSettingsRequest } from "./form-settings-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }

test("CMS form settings are tenant-scoped and bounded", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); return { rows: [{ id: "default", webhook_url: null, notify_email: "ops@example.com", updated_at: "2026-01-01" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleAdminCmsFormSettingsRequest(new Request("https://api.test/api/admin/cms/forms/settings", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.ok(queries[0]?.includes("organization_id = $2") && queries[0]?.includes("LIMIT 1"));
});

test("CMS form settings updates require durable idempotency", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); if (text.includes("worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }] as unknown as T[], rowCount: 1 }; if (text.startsWith("INSERT INTO public.cms_form_settings")) return { rows: [{ id: "default", webhook_url: "https://hooks.example", notify_email: null, updated_at: "2026-01-01" }] as unknown as T[], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const missing = await handleAdminCmsFormSettingsRequest(new Request("https://api.test/api/admin/cms/forms/settings", { method: "PUT", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ webhook_url: "https://hooks.example" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const response = await handleAdminCmsFormSettingsRequest(new Request("https://api.test/api/admin/cms/forms/settings", { method: "PUT", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "settings-1", "Content-Type": "application/json" }, body: JSON.stringify({ webhook_url: "https://hooks.example" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.ok(queries.some((query) => query.includes("INSERT INTO public.cms_form_settings") && query.includes("organization_id")));
});
