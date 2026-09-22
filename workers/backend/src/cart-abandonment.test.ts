import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleCartAbandonmentRequest } from "./cart-abandonment.ts";

const secret = "storefront-secret";
function database() { const statements: string[] = []; return { statements, query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => { statements.push(`${text}|${JSON.stringify(values)}`); if (text.includes("RETURNING id")) return { rows: [{ id: "abandon-1" }], rowCount: 1 } as { rows: T[]; rowCount: number }; return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number }; }, end: async () => {} }; }
test("cart abandonment requires the signed Next-to-Worker request and records bounded data", async () => {
  const body = JSON.stringify({ email: "Customer@Example.com", lines: [{ id: "line-1" }], path: "/checkout", referrer: "https://example.test", clientTimestamp: "2026-09-21T00:00:00Z" });
  const db = database();
  const response = await handleCartAbandonmentRequest(new Request("https://worker.test/store/cart/abandonment", { method: "POST", headers: { "x-storefront-signature": createHmac("sha256", secret).update(body).digest("base64url"), "Content-Type": "application/json" }, body }), db, { AUTH_SECRET: secret });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.ok(db.statements.some((statement) => statement.includes("cart_abandonment_events") && statement.includes("customer@example.com")));
});
test("cart abandonment rejects unsigned direct requests before database access", async () => {
  const db = database();
  const response = await handleCartAbandonmentRequest(new Request("https://worker.test/store/cart/abandonment", { method: "POST", body: JSON.stringify({ lines: [] }) }), db, { AUTH_SECRET: secret });
  assert.equal(response.status, 401);
  assert.equal(db.statements.length, 0);
});
