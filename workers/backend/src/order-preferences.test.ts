import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCustomerOrderPreferencesRequest } from "./order-preferences.ts";

async function bearer(secret: string, claims: Record<string, unknown>) {
  const encode = (value: string) => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(JSON.stringify({ iat: now, exp: now + 300, ...claims }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))).toString("base64url");
  return `Bearer ${header}.${payload}.${signature}`;
}

function db() {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string) {
      queries.push(text);
      return { rows: [{ out_of_stock_action: "ask_me" }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  return { database, queries };
}

test("order preferences authenticate, validate, and upsert within the tenant", async () => {
  const { database, queries } = db();
  const response = await handleCustomerOrderPreferencesRequest(
    new Request("https://worker.test/store/customers/me/order-preferences", {
      method: "PATCH",
      headers: { Authorization: await bearer("secret", { sub: "user-1", email: "buyer@example.com" }), "Content-Type": "application/json" },
      body: JSON.stringify({ outOfStockAction: "ask_me" }),
    }),
    database,
    { JWT_SECRET: "secret", DEFAULT_ORGANIZATION_ID: "org-1" },
  );
  assert.equal(response.status, 200);
  assert.match(queries[0] ?? "", /ON CONFLICT \(organization_id, customer_email\)/);
});

test("order preferences reject invalid actions before database access", async () => {
  const { database, queries } = db();
  const response = await handleCustomerOrderPreferencesRequest(
    new Request("https://worker.test/store/customers/me/order-preferences", {
      method: "PATCH",
      headers: { Authorization: await bearer("secret", { sub: "user-1", email: "buyer@example.com" }), "Content-Type": "application/json" },
      body: JSON.stringify({ outOfStockAction: "ship_anyway" }),
    }),
    database,
    { JWT_SECRET: "secret", DEFAULT_ORGANIZATION_ID: "org-1" },
  );
  assert.equal(response.status, 400);
  assert.equal(queries.length, 0);
});
