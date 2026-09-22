import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handlePaymentRecoveryMetricsRequest } from "./payment-recovery-admin.ts";

function token(claims: Record<string, unknown> = {}): string {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const h = enc({ alg: "HS256", typ: "JWT" });
  const p = enc({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: Math.floor(Date.now() / 1000) + 300, ...claims });
  return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`;
}

test("payment recovery metrics are tenant scoped and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async (text: string, values: readonly unknown[] = []) => { queries.push({ text, values }); return { rows: [{ day: "2026-09-21", count: "2" }], rowCount: 1 }; }, end: async () => {} };
  const response = await handlePaymentRecoveryMetricsRequest(new Request("https://api.test/api/admin/commerce-recovery-metrics?days=14", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { days: 14, buckets: [{ day: "2026-09-21", count: 2 }], totalInvalidationsInWindow: 2 });
  assert.deepEqual(queries[0]?.values, ["org_1", 14]);
  assert.match(queries[0]?.text ?? "", /organization_id = \$1/);
  assert.match(queries[0]?.text ?? "", /LIMIT|GROUP BY/);
  const invalid = await handlePaymentRecoveryMetricsRequest(new Request("https://api.test/api/admin/commerce-recovery-metrics?days=91", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(invalid.status, 400);
});
