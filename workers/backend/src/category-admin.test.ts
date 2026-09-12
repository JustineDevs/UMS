import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminCategoryRequest } from "./category-admin.ts";

function b64(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function token(claims: Record<string, unknown>): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff_1", ...claims, exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("admin-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

test("CMS category admin requires a staff token", async () => {
  const response = await handleCmsAdminCategoryRequest(new Request("https://api.example/admin/cms/category-content"), { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} }, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 401);
});

test("CMS category admin lists only the authenticated tenant", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [{ organization_id: "org_1", collection_handle: "guitars" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminCategoryRequest(new Request("https://api.example/admin/cms/category-content", { headers: { Authorization: `Bearer ${bearer}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0]?.values, ["org_1"]);
  assert.equal((await response.json() as { data: Array<{ organization_id: string }> }).data[0]?.organization_id, "org_1");
});

test("CMS category admin upsert uses tenant identity and idempotency", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 }; if (text.startsWith("INSERT INTO public.cms_category_content")) return { rows: [{ organization_id: "org_1", collection_handle: "guitars" }] as unknown as T[], rowCount: 1 }; return { rows: [] as T[], rowCount: 1 }; }, async end() {} };
  const bearer = await token({ organization_id: "org_1", role: "admin" });
  const response = await handleCmsAdminCategoryRequest(new Request("https://api.example/admin/cms/category-content", { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "category-1", "Content-Type": "application/json" }, body: JSON.stringify({ collection_handle: "guitars", title: "ignored-client-field", blocks: [] }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  const insert = queries.find((query) => query.text.startsWith("INSERT INTO public.cms_category_content"));
  assert.equal(insert?.values[1], "org_1");
  assert.ok(insert?.text.includes("ON CONFLICT (organization_id, collection_handle, locale)"));
});
