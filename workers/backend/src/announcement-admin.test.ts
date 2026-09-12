import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminAnnouncementRequest } from "./announcement-admin.ts";

function b64(value: string): string { return btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function bearer(): Promise<string> {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: 2_000_000_000 }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("admin-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${payload}.${signature}`;
}

test("announcement admin requires the explicit staff token", async () => {
  const response = await handleCmsAdminAnnouncementRequest(new Request("https://api.example/admin/cms/announcement", { method: "PUT", body: "{}" }), { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} }, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 401);
});

test("announcement admin upserts only within the token tenant", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 }; if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; if (text.startsWith("INSERT INTO public.cms_announcement")) return { rows: [{ id: "default", organization_id: "org_1", locale: "en", body: "Sale" }] as unknown as T[], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const response = await handleCmsAdminAnnouncementRequest(new Request("https://api.example/api/admin/cms/announcement", { method: "PUT", headers: { Authorization: `Bearer ${await bearer()}`, "Idempotency-Key": "announcement-1" }, body: JSON.stringify({ body: "Sale", link_url: "/shop" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { data: { organization_id: string } }).data.organization_id, "org_1");
  assert.equal(queries.find((query) => query.text.startsWith("INSERT INTO public.cms_announcement"))?.values[1], "org_1");
});
