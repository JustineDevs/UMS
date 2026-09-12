import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCustomerOrderDetailRequest, handleCustomerOrdersRequest, handleCustomerReceiptRequest } from "./orders.ts";

async function workerToken(secret: string, claims: Record<string, unknown>): Promise<string> {
  const encode = (value: string): string => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60, ...claims }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
}

test("receipt retrieval rejects unauthenticated access before querying", async () => {
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(_text: string, _values: readonly unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
      throw new Error("database must not be queried");
    },
    async end() {},
  };
  const response = await handleCustomerReceiptRequest(
    new Request("https://api.example/store/customers/me/orders/order_1/receipt"),
    database,
    { JWT_SECRET: "secret" },
    "order_1",
  );
  assert.equal(response.status, 404);
});

test("receipt retrieval accepts the authenticated email for a native order", async () => {
  const token = await workerToken("secret", { sub: "auth-user-1", email: "buyer@example.com" });
  let values: readonly unknown[] = [];
  const response = await handleCustomerReceiptRequest(
    new Request("https://api.example/store/customers/me/orders/order_1/receipt", { headers: { Authorization: `Bearer ${token}` } }),
    {
      async query<Row>(_text: string, queryValues: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
        values = queryValues;
        return { rows: [{ id: "receipt_1", order_id: "order_1", customer_email: "buyer@example.com", receipt_html: "<p>Receipt</p>", sent_at: null, created_at: "2026-01-01T00:00:00Z" }] as Row[], rowCount: 1 };
      },
      async end() {},
    },
    { JWT_SECRET: "secret" },
    "order_1",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(values, ["order_1", "auth-user-1", "buyer@example.com"]);
});

test("customer order listing reads quantities from order_item", async () => {
  let query = "";
  const encode = (value: string): string =>
    Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ sub: "customer_1", exp: Math.floor(Date.now() / 1000) + 60 }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const token = `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
  const response = await handleCustomerOrdersRequest(
    new Request("https://api.example/store/customers/me/orders", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    {
      async query<Row>(text: string): Promise<{ rows: Row[]; rowCount: number }> {
        query = text;
        return { rows: [] as Row[], rowCount: 0 };
      },
      async end() {},
    },
    { JWT_SECRET: "secret" },
  );
  assert.equal(response.status, 200);
  assert.match(query, /SUM\(oi\.quantity\)/);
  assert.match(query, /order_item oi/);
});

test("customer order listing falls back to the authenticated email for native orders", async () => {
  let values: readonly unknown[] = [];
  const encode = (value: string): string => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ sub: "auth-user-1", email: "buyer@example.com", exp: Math.floor(Date.now() / 1000) + 60 }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  const token = `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
  const response = await handleCustomerOrdersRequest(
    new Request("https://api.example/store/customers/me/orders", { headers: { Authorization: `Bearer ${token}` } }),
    {
      async query<Row>(_text: string, queryValues: readonly unknown[] = []): Promise<{ rows: Row[]; rowCount: number }> {
        values = queryValues;
        return { rows: [] as Row[], rowCount: 0 };
      },
      async end() {},
    },
    { JWT_SECRET: "secret" },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(values, ["auth-user-1", "buyer@example.com", 20, 0]);
});

test("customer order detail returns native items and totals only for the authenticated owner", async () => {
  const token = await workerToken("secret", { sub: "auth-user-1", email: "buyer@example.com" });
  const response = await handleCustomerOrderDetailRequest(
    new Request("https://api.example/store/customers/me/orders/order_1", { headers: { Authorization: `Bearer ${token}` } }),
    {
      async query<Row>(text: string): Promise<{ rows: Row[]; rowCount: number }> {
        if (text.includes("jsonb_build_object")) {
          return { rows: [{ id: "order_1", display_id: 42, status: "pending", total: "5997", subtotal: "5997", tax_total: "0", shipping_total: "0", discount_total: "0", currency_code: "php", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", payment_status: "captured", fulfillment_status: "not_fulfilled", customer_id: "auth-user-1", email: "buyer@example.com", metadata: {}, shipping_address: { city: "Manila" }, item_count: "1" }] as Row[], rowCount: 1 };
        }
        return { rows: [{ id: "oli_1", title: "Canary", quantity: "1", unit_price: "5997", variant_sku: "GUITAR-1", thumbnail: null }] as Row[], rowCount: 1 };
      },
      async end() {},
    },
    { JWT_SECRET: "secret" },
    "order_1",
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { order: { total: string; items: Array<{ total: number; variant: { sku: string } }> } };
  assert.equal(body.order.total, "5997");
  assert.equal(body.order.items[0]?.total, 5997);
  assert.equal(body.order.items[0]?.variant.sku, "GUITAR-1");
});
