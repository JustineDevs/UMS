import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminCmsComponentsRequest } from "./cms-components-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }
const definition = { id: "hero-banner", name: "Hero", description: "Hero component", category: "Content", structure: "section", styleTokens: {}, props: [], slots: [], variants: [{ id: "default", label: "Default" }] };
const row = { id: "component_1", organization_id: "org_1", component_key: "hero-banner", definition, version: 1, status: "draft", created_by: "staff_1", updated_by: "staff_1", created_at: "2026-01-01", updated_at: "2026-01-01" };

test("CMS component reads are tenant scoped and projected", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [row] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleAdminCmsComponentsRequest(new Request("https://api.test/api/admin/cms/components/hero-banner", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "hero-banner");
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0]?.values, ["org_1", "hero-banner", 500]);
  assert.ok(queries[0]?.text.includes("organization_id = $1") && !queries[0]?.text.includes("SELECT *"));
});

test("CMS component saves require idempotency, optimistic versioning, and audit", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); if (text.includes("worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }] as unknown as T[], rowCount: 1 }; if (text.startsWith("SELECT id, organization_id")) return { rows: [] as T[], rowCount: 0 }; if (text.startsWith("INSERT INTO public.cms_component_definitions")) return { rows: [row] as unknown as T[], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const missing = await handleAdminCmsComponentsRequest(new Request("https://api.test/api/admin/cms/components", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ definition }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const response = await handleAdminCmsComponentsRequest(new Request("https://api.test/api/admin/cms/components", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "component-1", "Content-Type": "application/json" }, body: JSON.stringify({ definition }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.ok(queries.some((query) => query === "BEGIN") && queries.some((query) => query.includes("cms_component_definition_versions")) && queries.some((query) => query.includes("audit_logs")));
});
