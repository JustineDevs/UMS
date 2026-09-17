import assert from "node:assert/strict";
import test from "node:test";
import { handleCustomerMarketingPreferencesRequest } from "./marketing-preferences.ts";
import type { WorkerDatabaseClient } from "./database.ts";

async function token(secret: string, claims: Record<string, unknown>) {
  const encode = (value: string) => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...claims }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))).toString("base64url");
  return `Bearer ${header}.${payload}.${signature}`;
}

function database() {
  const queries: string[] = [];
  const db: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string) {
      queries.push(text);
      return { rows: text.startsWith("SELECT") ? [] as T[] : [{ channel: "email", consent_status: "subscribed", source: "account_preferences", consented_at: null, unsubscribed_at: null, updated_at: "2026-09-13T00:00:00.000Z" }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  return { db, queries };
}

test("marketing preferences are authenticated, tenant-scoped, and durable", async () => {
  const { db, queries } = database();
  const authorization = await token("secret", { sub: "user-1", email: "Buyer@example.com" });
  const response = await handleCustomerMarketingPreferencesRequest(
    new Request("https://worker.test/store/customers/me/marketing-preferences", { method: "PATCH", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify({ subscribed: true }) }),
    db,
    { JWT_SECRET: "secret", DEFAULT_ORGANIZATION_ID: "org-1" },
  );
  assert.equal(response.status, 200);
  assert.match(queries[0] ?? "", /ON CONFLICT \(organization_id, email, channel\)/);
  assert.deepEqual(await response.json(), { preference: { channel: "email", consent_status: "subscribed", source: "account_preferences", consented_at: null, unsubscribed_at: null, updated_at: "2026-09-13T00:00:00.000Z" } });
});

test("marketing preferences fail closed without tenant configuration", async () => {
  const { db } = database();
  const authorization = await token("secret", { sub: "user-1", email: "buyer@example.com" });
  const response = await handleCustomerMarketingPreferencesRequest(new Request("https://worker.test/store/customers/me/marketing-preferences", { headers: { Authorization: authorization } }), db, { JWT_SECRET: "secret" });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "organization_not_configured" });
});
