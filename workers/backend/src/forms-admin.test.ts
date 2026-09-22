import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCmsAdminFormSubmissionsExportRequest, handleCmsAdminFormSubmissionsRequest } from "./forms-admin.ts";

function encode(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function token(): Promise<string> {
  const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("admin-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${payload}.${signature}`;
}

test("form submission export is tenant scoped, bounded, and CSV safe", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      if (text.startsWith("SELECT id, form_key")) return { rows: [{ id: "submission-1", form_key: "contact", created_at: "2026-09-21T00:00:00.000Z", read_at: null, assigned_to: null, spam_score: 0, payload: { message: "hello, world" } }] as unknown as T[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  const response = await handleCmsAdminFormSubmissionsExportRequest(new Request("https://api.example/api/admin/cms/forms/submissions/export?form_key=contact", { headers: { Authorization: `Bearer ${await token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"\{""message"":""hello, world""\}"/);
  assert.deepEqual(queries[0]?.values, ["org_1", "contact"]);
  assert.match(queries[0]?.text ?? "", /organization_id = \$1/);
  assert.match(queries[0]?.text ?? "", /LIMIT 1000/);
  assert.ok(queries.some((query) => query.text.includes("INSERT INTO public.audit_logs")));
});

test("form submission list and update are tenant-scoped, bounded, and replayable", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string) { queries.push(text); if (text.includes("COUNT(*)")) return { rows: [{ total: 1 }] as unknown as T[], rowCount: 1 }; if (text.includes("SELECT id,form_key")) return { rows: [{ id: "submission-1", form_key: "contact", payload: {}, created_at: "2026-09-21T00:00:00.000Z", ip_hash: null, read_at: null, assigned_to: null, spam_score: 0 }] as unknown as T[], rowCount: 1 }; if (text.includes("UPDATE public.cms_form_submissions")) return { rows: [{ id: "submission-1", form_key: "contact", payload: {}, created_at: "2026-09-21T00:00:00.000Z", ip_hash: null, read_at: "2026-09-21T00:00:00.000Z", assigned_to: null, spam_score: 0 }] as unknown as T[], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, async end() {} };
  const auth = { Authorization: `Bearer ${await token()}` };
  const list = await handleCmsAdminFormSubmissionsRequest(new Request("https://api.example/api/admin/cms/forms/submissions?limit=10", { headers: auth }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(list.status, 200); assert.equal((await list.json()).data[0].id, "submission-1"); assert.match(queries[1] ?? "", /LIMIT \$2 OFFSET \$3/);
  const update = await handleCmsAdminFormSubmissionsRequest(new Request("https://api.example/api/admin/cms/forms/submissions/submission-1", { method: "PATCH", headers: { ...auth, "Idempotency-Key": "form-key" }, body: JSON.stringify({ read_at: "2026-09-21T00:00:00.000Z" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "submission-1");
  assert.equal(update.status, 200); assert.equal((await update.json()).data.id, "submission-1"); assert.ok(queries.some((query) => query.includes("organization_id=$8")));
});
