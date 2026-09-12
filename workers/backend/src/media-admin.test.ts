import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminMediaDeleteRequest, handleCmsAdminMediaListRequest, handleCmsAdminMediaUploadRequest } from "./media-admin.ts";

function enc(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function token(claims: Record<string, unknown>): Promise<string> {
  const header = enc({ alg: "HS256", typ: "JWT" }); const payload = enc({ sub: "staff_1", ...claims, exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("admin-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...sig)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

test("CMS media list denies a staff token without a read permission", async () => {
  const bearer = await token({ organization_id: "org_1", permissions: ["orders:read"] });
  const response = await handleCmsAdminMediaListRequest(new Request("https://api.example/admin/cms/media", { headers: { Authorization: `Bearer ${bearer}` } }), { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} }, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 403);
});

test("CMS media list scopes tenant and applies bounded filters", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [{ organization_id: "org_1", id: "asset_1" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminMediaListRequest(new Request("https://api.example/admin/cms/media?q=guitar&mime=image/&tag=catalog-product&limit=999&sort=name_asc", { headers: { Authorization: `Bearer ${bearer}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0]?.values, ["org_1", "%guitar%", "image/%", "catalog-product", 500]);
  assert.match(queries[0]?.text ?? "", /organization_id = \$1/);
  assert.match(queries[0]?.text ?? "", /ORDER BY display_name ASC LIMIT \$5/);
});

test("CMS media upload writes to Supabase storage and persists tenant metadata", async () => {
  const calls: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { calls.push(text); return { rows: [{ id: "media-1", public_url: "https://supabase.example/storage/v1/object/public/catalog/public/file.png" }] as T[], rowCount: 1 }; }, async end() {} };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response("{}", { status: 200 }); };
  try {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "cover.png", { type: "image/png" }));
    const response = await handleCmsAdminMediaUploadRequest(new Request("https://api.example/admin/catalog/media", { method: "POST", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}` }, body: form }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" });
    assert.equal(response.status, 201);
    assert.ok(calls.some((call) => call.includes("/storage/v1/object/catalog/")));
    assert.ok(calls.some((query) => query.includes("INSERT INTO public.cms_media")));
  } finally { globalThis.fetch = originalFetch; }
});

test("CMS media delete refuses tenant-scoped assets still referenced by CMS content", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: ["catalog-product"] }] as T[], rowCount: 1 };
      if (text.includes("FROM public.cms_pages")) return { rows: [{ slug: "home", locale: "en" }] as T[], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const response = await handleCmsAdminMediaDeleteRequest(new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}` } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "media-1");
  assert.equal(response.status, 409);
  assert.match(await response.text(), /media_in_use/);
  assert.equal(queries.some((query) => query.startsWith("UPDATE public.cms_media")), false);
});

test("CMS media delete soft-deletes tenant metadata and removes its storage object", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: ["catalog-product"] }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.cms_media")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => { calls.push(`${init?.method ?? "GET"} ${String(input)}`); return new Response(null, { status: 204 }); };
  try {
    const response = await handleCmsAdminMediaDeleteRequest(new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}` } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" }, "media-1");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, storageCleanup: "removed" });
    assert.ok(queries.some((query) => query.startsWith("UPDATE public.cms_media")));
    assert.ok(calls.some((call) => call.includes("DELETE https://supabase.example/storage/v1/object/catalog/public/file.png")));
  } finally { globalThis.fetch = originalFetch; }
});
