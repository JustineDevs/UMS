import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminPageRequest } from "./cms-admin.ts";

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

test("CMS admin writes require explicit staff claims", async () => {
  const response = await handleCmsAdminPageRequest(
    new Request("https://api.example/admin/cms/pages", { method: "POST", body: JSON.stringify({ slug: "home" }) }),
    { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} },
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 401);
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
      if (text.startsWith("SELECT * FROM public.cms_pages")) return { rows: [existing] as unknown as T[], rowCount: 1 };
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
  const pageQuery = queries.find((query) => query.text.startsWith("SELECT * FROM public.cms_pages"));
  assert.deepEqual(pageQuery?.values, ["org_1", "page_1"]);
  assert.ok(queries.some((query) => query.text.includes("cms_page_versions")));
  assert.ok(queries.some((query) => query.text.includes("cms_page_mutations")));
});
