import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminPageMutationsRequest, handleCmsAdminPageRequest } from "./cms-admin.ts";

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeBytes(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function token(claims: Record<string, unknown>): Promise<string> {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", ...claims, exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("admin-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = encodeBytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))));
  return `${header}.${payload}.${signature}`;
}

test("CMS admin rejects anonymous page writes and mutation reads before database access", async () => {
  const database: WorkerDatabaseClient = {
    async query() {
      throw new Error("unauthorized CMS requests must not access the database");
    },
    async end() {},
  };
  const write = await handleCmsAdminPageRequest(
    new Request("https://api.example/api/admin/cms/pages", {
      method: "POST",
      headers: { "Idempotency-Key": "anonymous-cms-write" },
      body: JSON.stringify({ slug: "home" }),
    }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(write.status, 401);
  assert.deepEqual(await write.json(), { error: "unauthorized" });

  const mutationRead = await handleCmsAdminPageMutationsRequest(
    new Request("https://api.example/api/admin/cms/pages/00000000-0000-4000-8000-000000000001/mutations"),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "00000000-0000-4000-8000-000000000001",
  );
  assert.equal(mutationRead.status, 401);
  assert.deepEqual(await mutationRead.json(), { error: "unauthorized" });
});

test("CMS admin page reads require content access and remain tenant scoped", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return { rows: [{ id: "page_1", organization_id: "org_1", slug: "home", locale: "en", status: "published" }] as unknown as T[], rowCount: 1 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminPageRequest(
    new Request("https://api.example/api/admin/cms/pages?locale=en", { headers: { Authorization: `Bearer ${bearer}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { data: Array<{ id: string }> }).data, [{ id: "page_1", organization_id: "org_1", slug: "home", locale: "en", status: "published" }]);
  assert.deepEqual(queries[0]?.values, ["org_1", "en"]);
  assert.match(queries[0]?.text ?? "", /organization_id = \$1/);
  assert.doesNotMatch(queries[0]?.text ?? "", /SELECT \*/);
});

test("CMS admin page detail preserves the singular response contract", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return { rows: [{ id: "page_1", organization_id: "org_1", slug: "home", locale: "en", version: 2 }] as unknown as T[], rowCount: 1 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminPageRequest(
    new Request("https://api.example/api/admin/cms/pages/page_1", { headers: { Authorization: `Bearer ${bearer}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "page_1",
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { data: { id: string } }).data, { id: "page_1", organization_id: "org_1", slug: "home", locale: "en", version: 2 });
  assert.deepEqual(queries[0]?.values, ["org_1", "page_1"]);
});

test("CMS admin page mutations are tenant scoped and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id FROM public.cms_pages")) return { rows: [{ id: "00000000-0000-4000-8000-000000000001" }] as unknown as T[], rowCount: 1 };
      return { rows: [{ id: "00000000-0000-4000-8000-000000000002", page_id: "00000000-0000-4000-8000-000000000001", organization_id: "org_1", revision: 2, sequence: 0, mutation: { type: "set-prop" }, created_at: "2026-09-21T00:00:00.000Z" }] as unknown as T[], rowCount: 1 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminPageMutationsRequest(
    new Request("https://api.example/api/admin/cms/pages/00000000-0000-4000-8000-000000000001/mutations", { headers: { Authorization: `Bearer ${bearer}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "00000000-0000-4000-8000-000000000001",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { data: Array<{ id: string }> }).data[0]?.id, "00000000-0000-4000-8000-000000000002");
  assert.deepEqual(queries[0]?.values, ["00000000-0000-4000-8000-000000000001", "org_1"]);
  assert.deepEqual(queries[1]?.values, ["00000000-0000-4000-8000-000000000001", "org_1"]);
  assert.match(queries[1]?.text ?? "", /LIMIT 1000/);
});

test("CMS admin page detail returns not found without leaking another tenant", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:read"] });
  const response = await handleCmsAdminPageRequest(
    new Request("https://api.example/api/admin/cms/pages/page_other", { headers: { Authorization: `Bearer ${bearer}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "page_other",
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_found" });
  assert.deepEqual(queries[0]?.values, ["org_1", "page_other"]);
});

test("CMS admin page delete is tenant scoped and idempotent", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("DELETE FROM public.cms_pages")) return { rows: [], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", permissions: ["content:write"] });
  const response = await handleCmsAdminPageRequest(
    new Request("https://api.example/api/admin/cms/pages/page_1", { method: "DELETE", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "cms-delete-1" } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "page_1",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const deleteQuery = queries.find((query) => query.text.startsWith("DELETE FROM public.cms_pages"));
  assert.deepEqual(deleteQuery?.values, ["org_1", "page_1"]);
});

test("CMS admin update is tenant scoped and records revision mutations", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const existing = {
    id: "page_1", organization_id: "org_1", slug: "home", locale: "en", version: 3,
    page_type: "static", title: "Old", body: "", blocks: [], tree: [], status: "draft",
  };
  const saved = { ...existing, title: "New", version: 4 };
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (text.includes("FROM public.cms_pages") && text.includes("FOR UPDATE")) return { rows: [existing] as unknown as T[], rowCount: 1 };
      if (text.startsWith("INSERT INTO public.cms_page_versions")) return { rows: [], rowCount: 1 };
      if (text.startsWith("UPDATE public.cms_pages")) return { rows: [saved] as unknown as T[], rowCount: 1 };
      if (text.startsWith("INSERT INTO public.cms_page_mutations")) return { rows: [], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", role: "admin" });
  const response = await handleCmsAdminPageRequest(
    new Request("https://api.example/api/admin/cms/pages/page_1", {
      method: "PUT",
      headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "cms-update-1", "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "home", title: "New", expectedVersion: 3, mutations: [{ type: "set-prop", nodeId: "root" }] }),
    }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    "page_1",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { data: { version: number } }).data.version, 4);
  const pageQuery = queries.find((query) => query.text.includes("FROM public.cms_pages") && query.text.includes("FOR UPDATE"));
  assert.deepEqual(pageQuery?.values, ["org_1", "page_1"]);
  assert.ok(!pageQuery?.text.includes("SELECT *"));
  assert.ok(queries.some((query) => query.text.includes("cms_page_versions")));
  assert.ok(queries.some((query) => query.text.includes("cms_page_mutations")));
});
