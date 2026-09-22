import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminMediaDeleteRequest, handleCmsAdminMediaDetailRequest, handleCmsAdminMediaListRequest, handleCmsAdminMediaUploadRequest } from "./media-admin.ts";

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
  globalThis.fetch = async (input: string | URL | Request) => { calls.push(String(input)); return new Response("{}", { status: 200 }); };
  try {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "cover.png", { type: "image/png" }));
    const response = await handleCmsAdminMediaUploadRequest(new Request("https://api.example/admin/catalog/media", { method: "POST", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}`, "Idempotency-Key": "media-upload-1" }, body: form }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" });
    assert.equal(response.status, 201);
    assert.ok(calls.some((call) => call.includes("/storage/v1/object/catalog/")));
    assert.ok(calls.some((query) => query.includes("INSERT INTO public.cms_media")));
    assert.ok(calls.some((query) => query.includes("INSERT INTO public.audit_logs")));
  } finally { globalThis.fetch = originalFetch; }
});

test("CMS upload uses the CMS bucket, requires content permission, and preserves CMS tags", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [{ id: "cms-media-1", tags: [], organization_id: "org_1" }] as T[], rowCount: 1 }; }, async end() {} };
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input: string | URL | Request) => { calls.push(String(input)); return new Response("{}", { status: 200 }); };
  try {
    const form = new FormData();
    form.set("file", new File(["image"], "hero.png", { type: "image/png" }));
    form.set("alt", "Homepage hero");
    const response = await handleCmsAdminMediaUploadRequest(new Request("https://api.example/admin/cms/media", { method: "POST", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:write"] })}`, "Idempotency-Key": "cms-upload-1" }, body: form }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" });
    assert.equal(response.status, 201);
    assert.ok(calls.some((call) => call.includes("/storage/v1/object/cms/")));
    assert.deepEqual(queries.find((query) => query.text.includes("INSERT INTO public.cms_media"))?.values?.[7], []);

    const deniedForm = new FormData();
    deniedForm.set("file", new File(["image"], "hero.png", { type: "image/png" }));
    deniedForm.set("alt", "Homepage hero");
    const denied = await handleCmsAdminMediaUploadRequest(new Request("https://api.example/admin/cms/media", { method: "POST", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["orders:write"] })}`, "Idempotency-Key": "cms-upload-denied" }, body: deniedForm }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" });
    assert.equal(denied.status, 403);
  } finally { globalThis.fetch = originalFetch; }
});

test("catalog media endpoint always constrains reads to catalog assets", async () => {
  let sql = "";
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { sql = text; return { rows: [] as T[], rowCount: 0 }; }, async end() {} };
  const response = await handleCmsAdminMediaListRequest(new Request("https://api.example/admin/catalog/media", { headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:read"] })}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.match(sql, /'catalog-product'|\$2 = ANY\(tags\)/);
});

test("media detail returns tenant-scoped metadata and rejects bucket-tag reassignment", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); if (text.includes("FROM public.cms_media")) return { rows: [{ id: "asset_1", organization_id: "org_1", storage_path: "products/a/image.png", public_url: "https://cdn.example/image.png", tags: ["catalog-product"], deleted_at: null }] as T[], rowCount: 1 }; if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 }; if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; return { rows: [], rowCount: 0 }; }, async end() {} };
  const read = await handleCmsAdminMediaDetailRequest(new Request("https://api.example/admin/cms/media/asset_1", { headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:read"] })}` } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "asset_1");
  assert.equal(read.status, 200);
  assert.match(queries[0]?.text ?? "", /organization_id = \$2/);

  const update = await handleCmsAdminMediaDetailRequest(new Request("https://api.example/admin/cms/media/asset_1", { method: "PATCH", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:write"] })}`, "Idempotency-Key": "media-retag-1", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["campaign"] }) }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "asset_1");
  assert.equal(update.status, 400);
  assert.deepEqual(await update.json(), { error: "media_bucket_tag_immutable" });
});

test("media metadata patch replays idempotently and persists only validated fields", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); if (text.includes("FROM public.cms_media")) return { rows: [{ id: "asset_2", organization_id: "org_1", storage_path: "public/image.png", public_url: "https://cdn.example/image.png", tags: [], deleted_at: null }] as T[], rowCount: 1 }; if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 }; if (text.startsWith("UPDATE public.cms_media")) return { rows: [{ id: "asset_2", display_name: "Hero", tags: [] }] as T[], rowCount: 1 }; if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; return { rows: [], rowCount: 0 }; }, async end() {} };
  const response = await handleCmsAdminMediaDetailRequest(new Request("https://api.example/admin/cms/media/asset_2", { method: "PATCH", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:write"] })}`, "Idempotency-Key": "media-patch-1", "Content-Type": "application/json" }, body: JSON.stringify({ display_name: "Hero" }) }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "asset_2");
  assert.equal(response.status, 200);
  assert.equal(queries.filter((query) => query.text.startsWith("UPDATE public.cms_media")).length, 1);
  assert.deepEqual(queries.find((query) => query.text.startsWith("UPDATE public.cms_media"))?.values?.slice(0, 2), ["asset_2", "org_1"]);
});

test("media mutation idempotency keys are stable but isolated by tenant, actor, and resource", async () => {
  const keys: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) {
        keys.push(String(values[0]));
        return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
      }
      if (text.includes("FROM public.cms_media")) {
        return { rows: [{ id: "asset_1", organization_id: "org_1", storage_path: "external/image.png", public_url: "https://cdn.example/image.png", tags: [], deleted_at: null }] as T[], rowCount: 1 };
      }
      if (text.startsWith("UPDATE public.cms_media")) {
        return { rows: [{ id: "asset_1", display_name: "Hero", tags: [] }] as T[], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };

  async function patchMedia(organizationId: string, subject: string, mediaId: string) {
    return handleCmsAdminMediaDetailRequest(
      new Request(`https://api.example/admin/cms/media/${mediaId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await token({ organization_id: organizationId, sub: subject, permissions: ["content:write"] })}`,
          "Idempotency-Key": "same-client-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: "Hero" }),
      }),
      database,
      database,
      { CMS_ADMIN_JWT_SECRET: "admin-secret" },
      mediaId,
    );
  }

  assert.equal((await patchMedia("org_1", "staff_1", "asset_1")).status, 200);
  assert.equal((await patchMedia("org_1", "staff_1", "asset_1")).status, 200);
  assert.equal((await patchMedia("org_2", "staff_1", "asset_1")).status, 200);
  assert.equal((await patchMedia("org_1", "staff_2", "asset_1")).status, 200);
  assert.equal((await patchMedia("org_1", "staff_1", "asset_2")).status, 200);
  const deletion = await handleCmsAdminMediaDeleteRequest(
    new Request("https://api.example/admin/cms/media/asset_1", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${await token({ organization_id: "org_1", sub: "staff_1", permissions: ["content:write"] })}`,
        "Idempotency-Key": "same-client-key",
      },
    }),
    database,
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "asset_1",
  );
  assert.equal(deletion.status, 200);

  assert.equal(keys.length, 6);
  assert.equal(keys[0], keys[1]);
  assert.equal(new Set(keys).size, 5);
  assert.ok(keys.every((key) => key.startsWith("cms-media:v1:") && key.length <= 255 && !key.includes("same-client-key")));
});

test("CMS media upload rejects replay-unsafe requests without an idempotency key", async () => {
  const response = await handleCmsAdminMediaUploadRequest(
    new Request("https://api.example/admin/catalog/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}` },
      body: new FormData(),
    }),
    { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} },
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "idempotency_key_required" });
});

test("CMS media delete refuses tenant-scoped assets still referenced by CMS content", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: ["catalog-product"] }] as T[], rowCount: 1 };
      if (text.includes("FROM public.cms_pages")) return { rows: [{ slug: "home", locale: "en" }] as T[], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const response = await handleCmsAdminMediaDeleteRequest(new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}`, "Idempotency-Key": "media-delete-1" } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "media-1");
  assert.equal(response.status, 409);
  assert.match(await response.text(), /media_in_use/);
  assert.equal(queries.some((query) => query.startsWith("UPDATE public.cms_media")), false);
});

test("CMS media delete protects assets referenced only by an unpublished navigation draft", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push(text);
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: [], organization_id: "org_1", deleted_at: null }] as T[], rowCount: 1 };
      if (text.includes("FROM public.cms_navigation_draft")) {
        assert.deepEqual(values, ["%https://cdn.example/file.png%", "org_1"]);
        return { rows: [{ id: "default" }] as T[], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const response = await handleCmsAdminMediaDeleteRequest(
    new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:write"] })}`, "Idempotency-Key": "media-delete-nav-draft" } }),
    database,
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "media-1",
  );
  assert.equal(response.status, 409);
  assert.match(await response.text(), /media_in_use/);
  assert.ok(queries.some((query) => query.includes("FROM public.cms_navigation_draft")));
  assert.equal(queries.some((query) => query.startsWith("UPDATE public.cms_media")), false);
});

test("CMS media delete atomically tombstones metadata and queues storage cleanup", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: ["catalog-product"], organization_id: "org_1", deleted_at: null }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.cms_media")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => { calls.push(`${init?.method ?? "GET"} ${String(input)}`); return new Response(null, { status: 204 }); };
  try {
    const response = await handleCmsAdminMediaDeleteRequest(new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}`, "Idempotency-Key": "media-delete-2" } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" }, "media-1");
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { ok: true, storageCleanup: "queued" });
    assert.ok(queries.some((query) => query.startsWith("UPDATE public.cms_media")));
    const mediaLock = queries.findIndex((query) => query.includes("FROM public.cms_media") && query.includes("FOR UPDATE"));
    const referenceScan = queries.findIndex((query) => query.includes("FROM public.cms_pages"));
    const tombstone = queries.findIndex((query) => query.startsWith("UPDATE public.cms_media"));
    assert.ok(mediaLock >= 0 && mediaLock < referenceScan && referenceScan < tombstone, "delete must lock the media row before checking references and tombstoning");
    assert.equal(calls.length, 0, "request must not delete storage inline before its DB tombstone commits");
  } finally { globalThis.fetch = originalFetch; }
});

test("CMS media database rollback never deletes the storage object", async () => {
  const statements: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      statements.push(text);
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 };
      if (text.startsWith("DELETE FROM public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: [], organization_id: "org_1", deleted_at: null }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.cms_media")) return { rows: [], rowCount: 1 };
      if (text.startsWith("INSERT INTO public.audit_logs")) throw new Error("audit insert failed");
      return { rows: [] as T[], rowCount: 0 };
    },
    async end() {},
  };
  let storageCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { storageCalls += 1; return new Response(null, { status: 204 }); };
  try {
    await assert.rejects(handleCmsAdminMediaDeleteRequest(
      new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:write"] })}`, "Idempotency-Key": "media-delete-db-failure" } }),
      database,
      database,
      { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" },
      "media-1",
    ), /audit insert failed/);
    assert.equal(storageCalls, 0);
    assert.ok(statements.includes("ROLLBACK"));
  } finally { globalThis.fetch = originalFetch; }
});

test("CMS media delete rejects replay-unsafe requests without an idempotency key", async () => {
  const response = await handleCmsAdminMediaDeleteRequest(
    new Request("https://api.example/admin/cms/media/media-1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["catalog:write"] })}` },
    }),
    { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} },
    { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} },
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "media-1",
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "idempotency_key_required" });
});

test("media deletion fails closed when any reference scan is unavailable", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      if (text.includes("FROM public.cms_media")) return { rows: [{ id: "media-1", storage_path: "public/file.png", public_url: "https://cdn.example/file.png", tags: [] }] as T[], rowCount: 1 };
      if (text.includes("FROM public.cms_pages")) throw new Error("database_unavailable");
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const originalFetch = globalThis.fetch;
  let storageTouched = false;
  globalThis.fetch = async () => { storageTouched = true; return new Response(null, { status: 204 }); };
  try {
    await assert.rejects(handleCmsAdminMediaDeleteRequest(new Request("https://api.example/admin/cms/media/media-1", { method: "DELETE", headers: { Authorization: `Bearer ${await token({ organization_id: "org_1", permissions: ["content:write"] })}`, "Idempotency-Key": "media-delete-scan-fail" } }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret", SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" }, "media-1"), /database_unavailable/);
    assert.equal(storageTouched, false);
    assert.equal(queries.some((query) => query.startsWith("UPDATE public.cms_media")), false);
  } finally { globalThis.fetch = originalFetch; }
});
