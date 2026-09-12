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
