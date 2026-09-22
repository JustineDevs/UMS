import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminBlockPresetsRequest } from "./block-presets-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300, ...claims });
  return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

test("block preset reads are tenant scoped and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [{ id: "preset_1", name: "Hero", blocks: [{ id: "b1", type: "hero", props: {} }], created_at: "2026-01-01" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleAdminBlockPresetsRequest(new Request("https://api.test/api/admin/cms/block-presets?limit=9999", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0]?.values, ["org_1", 500]);
  assert.ok(queries[0]?.text.includes("organization_id = $1") && queries[0]?.text.includes("LIMIT $2"));
});

test("block preset mutations require idempotency and preserve tenant scope", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); if (text.includes("worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 }; if (text.startsWith("INSERT INTO public.cms_page_block_presets")) return { rows: [{ id: "preset_1", name: "Hero", blocks: [], created_at: "2026-01-01" }] as unknown as T[], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const missing = await handleAdminBlockPresetsRequest(new Request("https://api.test/api/admin/cms/block-presets", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Hero", blocks: [] }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const created = await handleAdminBlockPresetsRequest(new Request("https://api.test/api/admin/cms/block-presets", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "preset-1", "Content-Type": "application/json" }, body: JSON.stringify({ name: "Hero", blocks: [] }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(created.status, 201);
  assert.ok(queries.some((query) => query.text.includes("organization_id") && query.text.includes("cms_page_block_presets")));
});
