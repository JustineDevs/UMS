import assert from "node:assert/strict";
import test from "node:test";
import { handleCustomerProfileRequest } from "./profile.ts";

async function token(): Promise<string> {
  const encode = (value: string): string => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ sub: "customer_1", email: "buyer@example.com" }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
}

test("profile reads by authenticated email and uses the real profile schema", async () => {
  let query = "";
  let values: readonly unknown[] = [];
  const response = await handleCustomerProfileRequest(
    new Request("https://api.example/store/customers/me", {
      headers: { Authorization: `Bearer ${await token()}` },
    }),
    {
      async query<Row>(text: string, parameters: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
        query = text;
        values = parameters;
        return { rows: [], rowCount: 0 };
      },
      async end() {},
    },
    { JWT_SECRET: "secret" },
  );
  assert.equal(response.status, 200);
  assert.match(query, /WHERE email = \$1/);
  assert.doesNotMatch(query, /medusa_customer_id/);
  assert.deepEqual(values, ["buyer@example.com"]);
});

test("profile rejects a client email that differs from the authenticated identity", async () => {
  const response = await handleCustomerProfileRequest(
    new Request("https://api.example/store/customers/me", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "attacker@example.com" }),
    }),
    { async query() { throw new Error("database must not be queried"); }, async end() {} },
    { JWT_SECRET: "secret" },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_profile" });
});

test("profile updates preserve omitted fields but allow explicit null clearing", async () => {
  let values: readonly unknown[] = [];
  const response = await handleCustomerProfileRequest(
    new Request("https://api.example/store/customers/me", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ display_name: null }),
    }),
    {
      async query<Row>(_text: string, parameters: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
        values = parameters;
        return { rows: [{ email: "buyer@example.com", display_name: null, phone: null, avatar_url: null, shipping_addresses: [], updated_at: "now" }] as Row[], rowCount: 1 };
      },
      async end() {},
    },
    { JWT_SECRET: "secret" },
  );
  assert.equal(response.status, 200);
  assert.equal(values[4], true);
  assert.equal(values[5], false);
  assert.equal(values[6], false);
});
