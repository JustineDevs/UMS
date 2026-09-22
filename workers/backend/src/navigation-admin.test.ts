import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminNavigationRequest } from "./navigation-admin.ts";

function encodeBytes(value: Uint8Array): string { return btoa(String.fromCharCode(...value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function encode(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function token(): Promise<string> {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("admin-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = encodeBytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))));
  return `${header}.${payload}.${signature}`;
}

test("navigation admin rejects requests without the explicit staff token", async () => {
  const response = await handleCmsAdminNavigationRequest(new Request("https://api.example/admin/cms/navigation", { method: "PUT", body: "{}" }), { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} }, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 401);
});

test("navigation admin persists a tenant-scoped draft idempotently", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  const response = await handleCmsAdminNavigationRequest(
    new Request("https://api.example/api/admin/cms/navigation", {
      method: "PUT",
      headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "nav-draft-1", "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "draft", payload: { headerLinks: [{ href: "/shop", label: "Shop" }], headerLinksMobile: [], footerColumns: [], footerBottomLinks: [], socialLinks: [] } }),
    }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { data: { headerLinks: unknown[] } }).data.headerLinks, [{ href: "/shop", label: "Shop" }]);
  assert.ok(queries.some((query) => query.text.includes("cms_navigation_draft") && query.values[0] === "org_1"));
});

test("navigation admin reads only the authenticated tenant and merges a valid draft", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.includes("cms_navigation_draft")) return { rows: [{ payload: { headerLinks: [{ href: "/sale", label: "Sale" }] } }] as unknown as T[], rowCount: 1 };
      return { rows: [{ header_links: [{ href: "/shop", label: "Shop" }], header_links_mobile: [], footer_columns: [], footer_bottom_links: [], social_links: [] }] as unknown as T[], rowCount: 1 };
    },
    async end() {},
  };
  const response = await handleCmsAdminNavigationRequest(
    new Request("https://api.example/api/admin/cms/navigation", { headers: { Authorization: `Bearer ${await token()}` } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { data: { headerLinks: unknown[] }; meta: { hasDraft: boolean } }).data.headerLinks, [{ href: "/sale", label: "Sale" }]);
  assert.deepEqual(queries[0]?.values, ["org_1"]);
  assert.deepEqual(queries[1]?.values, ["org_1"]);
});

test("navigation publish promotes the persisted tenant draft without trusting client payload", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const draft = { headerLinks: [{ href: "/sale", label: "Sale" }], headerLinksMobile: [], footerColumns: [], footerBottomLinks: [], socialLinks: [] };
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.includes("cms_navigation_draft") && text.startsWith("SELECT")) return { rows: [{ payload: draft }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  const response = await handleCmsAdminNavigationRequest(
    new Request("https://api.example/api/admin/cms/navigation/publish", { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "nav-publish-1" } }),
    database,
    { CMS_ADMIN_JWT_SECRET: "admin-secret" },
    true,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { data: { headerLinks: unknown[] }; meta: { hasDraft: boolean } }).data.headerLinks, draft.headerLinks);
  assert.ok(queries.some((query) => query.text.includes("cms_navigation_draft") && query.values[0] === "org_1"));
  assert.ok(queries.some((query) => query.text.includes("INSERT INTO public.cms_navigation") && query.values[0] === "org_1"));
});
