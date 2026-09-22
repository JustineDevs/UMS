import assert from "node:assert/strict";
import test from "node:test";
import { handleCustomerLoyaltyRequest } from "./loyalty.ts";
import type { WorkerDatabaseClient } from "./database.ts";

async function token() {
  const encode = (value: string) => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ sub: "customer-1", email: "buyer@example.com", exp: Math.floor(Date.now() / 1000) + 300 }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))).toString("base64url");
  return `Bearer ${header}.${payload}.${signature}`;
}

test("loyalty is authenticated, bounded, and reads only the authenticated account", async () => {
  const queries: string[] = [];
  const db: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); return text.includes("loyalty_accounts") ? { rows: [{ id: "account-1", points_balance: 10, lifetime_points: 20, tier: "silver", updated_at: "now" }] as T[], rowCount: 1 } : { rows: [{ id: "tx-1", points_delta: 10, reason: "purchase", order_id: null, created_at: "now" }] as T[], rowCount: 1 }; }, async end() {} };
  const response = await handleCustomerLoyaltyRequest(new Request("https://worker.test/store/customers/me/loyalty", { headers: { Authorization: await token() } }), db, { JWT_SECRET: "secret" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).account.id, "account-1");
  assert.match(queries[0] ?? "", /lower\(customer_email\)/);
  assert.match(queries[1] ?? "", /LIMIT 50/);
});
