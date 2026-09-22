import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminCmsExperimentsRequest } from "./cms-experiments-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

test("CMS experiments are tenant-scoped and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [{ id: "exp_1", organization_id: "org_1", experiment_key: "hero-test", name: "Hero", variants: [{ id: "a", label: "A" }], active: true, updated_at: "2026-01-01", starts_at: null, ends_at: null, traffic_cap_pct: 100, target_page_slug: null, target_component_key: null, impressions: 2, conversions: 1 }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleAdminCmsExperimentsRequest(new Request("https://api.test/api/admin/cms/experiments?limit=9999", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0]?.values, ["org_1", 500]);
  assert.ok(queries[0]?.text.includes("organization_id = $1") && queries[0]?.text.includes("LIMIT $2") && !queries[0]?.text.includes("SELECT *"));
});

test("CMS experiment mutations require idempotency and audit the tenant write", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); if (text.includes("worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 }; if (text.startsWith("INSERT INTO public.cms_ab_experiments")) return { rows: [{ id: "exp_1", organization_id: "org_1", experiment_key: "hero-test", name: "Hero", variants: [{ id: "a", label: "A" }], active: false, updated_at: "2026-01-01", starts_at: null, ends_at: null, traffic_cap_pct: null, target_page_slug: null, target_component_key: null, impressions: 0, conversions: 0 }] as unknown as T[], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const missing = await handleAdminCmsExperimentsRequest(new Request("https://api.test/api/admin/cms/experiments", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ experiment_key: "hero-test", variants: [{ id: "a", label: "A" }] }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const response = await handleAdminCmsExperimentsRequest(new Request("https://api.test/api/admin/cms/experiments", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "experiment-1", "Content-Type": "application/json" }, body: JSON.stringify({ experiment_key: "hero-test", variants: [{ id: "a", label: "A" }] }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.ok(queries.some((query) => query.text.includes("cms_ab_experiments") && query.text.includes("organization_id")));
  assert.ok(queries.some((query) => query.text.includes("audit_logs")));
});
