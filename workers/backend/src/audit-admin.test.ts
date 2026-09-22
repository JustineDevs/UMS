import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAuditLogsRequest } from "./audit-admin.ts";

function token(claims: Record<string, unknown> = {}): string {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const h = enc({ alg: "HS256", typ: "JWT" });
  const p = enc({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: Math.floor(Date.now() / 1000) + 300, ...claims });
  return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`;
}

test("audit logs are tenant scoped, bounded, filter validated, and CSV safe", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async (text: string, values: readonly unknown[] = []) => {
    queries.push({ text, values });
    return { rows: [{ id: "audit-1", action: "cms,update", resource: "cms_page", details: { organization_id: "org_1", note: "safe" }, created_at: "2026-09-21T00:00:00.000Z", actor_id: "staff_1", actor_email: "a@example.com", actor_name: "A" }], rowCount: 1 };
  }, end: async () => {} };
  const response = await handleAuditLogsRequest(new Request("https://api.test/api/admin/audit-logs?format=csv&resource_prefix=cms&limit=5", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"cms,update"/);
  assert.equal(queries[0]?.values[0], "org_1");
  assert.match(queries[0]?.text ?? "", /details->>'organization_id'/);
  assert.match(queries[0]?.text ?? "", /LIMIT \$3/);
  assert.equal((await handleAuditLogsRequest(new Request("https://api.test/api/admin/audit-logs?limit=0", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" })).status, 400);
});
