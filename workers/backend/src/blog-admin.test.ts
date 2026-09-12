import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminBlogRequest } from "./blog-admin.ts";

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function token(claims: Record<string, unknown>): Promise<string> {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", ...claims, exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("admin-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  ));
  const encodedSignature = btoa(String.fromCharCode(...signature))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${payload}.${encodedSignature}`;
}

test("CMS blog admin requires the explicit staff token", async () => {
  const response = await handleCmsAdminBlogRequest(
    new Request("https://api.example/admin/cms/blog", { method: "GET" }),
    { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} },
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 401);
});

test("CMS blog admin writes use the authenticated tenant and replay idempotently", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const stored = {
    id: "blog_1",
    organization_id: "org_1",
    slug: "new-release",
    locale: "en",
    title: "New release",
    body: "Details",
  };
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ) {
      queries.push({ text, values });
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) {
        return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      }
      if (text.startsWith("INSERT INTO public.cms_blog_posts")) {
        return { rows: [stored] as unknown as T[], rowCount: 1 };
      }
      if (text.startsWith("UPDATE public.worker_idempotency_records")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org_1", role: "admin" });
  const body = JSON.stringify({
    slug: "new-release",
    title: "New release",
    body: "Details",
    organization_id: "attacker-org",
  });
  const response = await handleCmsAdminBlogRequest(
    new Request("https://api.example/admin/cms/blog", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Idempotency-Key": "blog-write-1",
        "Content-Type": "application/json",
      },
      body,
    }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { data: { organization_id: string } }).data.organization_id, "org_1");
  const insert = queries.find((query) => query.text.startsWith("INSERT INTO public.cms_blog_posts"));
  assert.equal(insert?.values[1], "org_1");
  assert.notEqual(insert?.values[1], "attacker-org");
  assert.ok(queries.some((query) => query.text.includes("ON CONFLICT (organization_id, slug, locale)")));
});

test("CMS blog admin rejects a missing idempotency key before parsing the body", async () => {
  const bearer = await token({ organization_id: "org_1", permissions: ["content:write"] });
  let queried = false;
  const database: WorkerDatabaseClient = {
    async query() {
      queried = true;
      return { rows: [], rowCount: 0 };
    },
    async end() {},
  };
  const response = await handleCmsAdminBlogRequest(
    new Request("https://api.example/admin/cms/blog", {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
      body: "not-json",
    }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 400);
  assert.equal(queried, false);
});
