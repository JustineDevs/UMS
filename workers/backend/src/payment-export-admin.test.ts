import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handlePaymentAttemptsExportRequest } from "./payment-export-admin.ts";

function token(): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: Math.floor(Date.now() / 1000) + 300 });
  const s = createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url"); return `${h}.${p}.${s}`;
}

test("payment attempts export is tenant scoped, bounded, escaped, and audited", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async (text: string, values: readonly unknown[] = []) => { queries.push({ text, values }); if (text.startsWith("SELECT")) return { rows: [{ id: "a1", provider: "stripe", status: "paid,verified", amount_minor: 100, currency: "PHP", updated_at: "2026-09-21T00:00:00.000Z" }], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, end: async () => {} };
  const response = await handlePaymentAttemptsExportRequest(new Request("https://api.example/api/admin/payment-attempts/export", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"paid,verified"/);
  assert.deepEqual(queries[0]?.values, ["org_1"]);
  assert.match(queries[0]?.text ?? "", /LIMIT 500/);
  assert.ok(queries.some((query) => query.text.includes("INSERT INTO public.audit_logs")));
});
