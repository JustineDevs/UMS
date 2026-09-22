import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminCategoryGapsRequest, handleCmsAdminCategoryRequest, handleCmsAdminCategorySyncRequest } from "./category-admin.ts";

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
  assert.ok(queries.every((query) => !query.text.includes("SELECT *")));
  assert.deepEqual(queries[0]?.values, ["org_1", 100]);
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
  assert.ok(queries.some((query) => query.text.includes("INSERT INTO public.audit_logs") && query.values[0] === "cms.category_content.upsert"));
});

test("category sync uses the commerce catalog and creates missing APP rows only", async () => {
  const writes: Array<{ sql: string; values: readonly unknown[] }> = [];
  let insertCount = 0;
  const app: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      writes.push({ sql, values });
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
      if (sql.includes("INSERT INTO public.cms_category_content")) return { rows: [] as T[], rowCount: insertCount++ === 0 ? 1 : 0 };
      return { rows: [] as T[], rowCount: 1 };
    },
    async end() {},
  };
  const commerce: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>() {
      return { rows: [{ id: "pc_1", name: "Amp & Co", handle: "amps" }, { id: "pc_2", name: "Guitars", handle: "guitars" }] as T[], rowCount: 2 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:write"] });
  const response = await handleCmsAdminCategorySyncRequest(
    new Request("https://api.example/api/admin/cms/category-content/sync-from-catalog?locale=en", { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "category-sync-1" } }),
    app,
    commerce,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { created: 1, locale: "en", totalCategories: 2 } });
  assert.deepEqual(writes.filter((item) => item.sql.includes("INSERT INTO public.cms_category_content")).map((item) => item.values), [
    ["org_1", "pc_1", "amps", "en", "<p>Amp &amp; Co</p>"],
    ["org_1", "pc_2", "guitars", "en", "<p>Guitars</p>"],
  ]);
  assert.ok(writes.find((item) => item.sql.includes("INSERT INTO public.cms_category_content"))?.sql.includes("ON CONFLICT (organization_id, collection_handle, locale) DO NOTHING"));
  assert.ok(writes.some((item) => item.sql.includes("INSERT INTO public.audit_logs") && item.values[0] === "cms.category_content.sync"));
});

test("category gaps compares tenant content against the commerce catalog", async () => {
  const appQueries: Array<{ sql: string; values: readonly unknown[] }> = [];
  const app: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      appQueries.push({ sql, values });
      return { rows: [{ collection_handle: "guitars" }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  const commerce: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>() {
      return { rows: [{ id: "pc_1", name: "Guitars", handle: "guitars" }, { id: "pc_2", name: "Amps", handle: "amps" }] as T[], rowCount: 2 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminCategoryGapsRequest(
    new Request("https://api.example/api/admin/cms/category-content/catalog-gaps?locale=en", { headers: { Authorization: `Bearer ${bearer}` } }),
    app,
    commerce,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(appQueries[0]?.values, ["org_1", "en"]);
  assert.deepEqual(await response.json(), {
    data: { locale: "en", catalog_count: 2, cms_rows_for_locale: 1, missing: [{ id: "pc_2", name: "Amps", handle: "amps" }] },
  });
});
