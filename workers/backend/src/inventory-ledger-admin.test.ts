import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleInventoryLedgerRequest } from "./inventory-ledger-admin.ts";

function token(): string { const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", organization_id: "org_1", role: "admin", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`; }

test("inventory ledger is tenant scoped, projected, and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async (text: string, values: readonly unknown[] = []) => { queries.push({ text, values }); return { rows: [{ id: "audit-1", created_at: "2026-09-21T00:00:00.000Z", actor_email: "staff@example.com", reason: "correction", reference_type: "manual", reference_id: "ref-1", product_id: "prod-1", variant_id: "var-1", location_id: null, quantity_before: "2", quantity_after: "3", quantity_delta: "1" }], rowCount: 1 }; }, end: async () => {} };
  const response = await handleInventoryLedgerRequest(new Request("https://api.test/api/admin/inventory/ledger?variant_id=var-1&limit=10", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { data: [{ id: "audit-1", created_at: "2026-09-21T00:00:00.000Z", actor_email: "staff@example.com", reason: "correction", reference_type: "manual", reference_id: "ref-1", product_id: "prod-1", variant_id: "var-1", location_id: null, quantity_before: 2, quantity_after: 3, quantity_delta: 1 }], organization_id: "org_1" });
  assert.deepEqual(queries[0]?.values, ["org_1", "var-1", 10]); assert.match(queries[0]?.text ?? "", /organization_id = \$1/); assert.match(queries[0]?.text ?? "", /LIMIT \$3/); assert.doesNotMatch(queries[0]?.text ?? "", /SELECT \*/);
});
