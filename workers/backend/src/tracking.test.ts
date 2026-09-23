import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleTrackingRequest } from "./tracking.ts";

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function capability(secret: string, id: string, purpose = "track", expiresAt = Math.floor(Date.now() / 1000) + 300): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({
    version: "v3", purpose, audience: "public-tracking", keyVersion: "v1",
    id, issuedAt, expiresAt,
  }));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return ["v3", "v1", String(issuedAt), String(expiresAt), base64Url(iv), base64Url(encrypted.slice(-16)), base64Url(encrypted.slice(0, -16))].join(".");
}

test("tracking rejects invalid capabilities before querying commerce", async () => {
  const database: WorkerDatabaseClient = {
    async query() { throw new Error("database must not be queried"); },
    async end() {},
  };
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/not-a-capability"),
    database,
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    "not-a-capability",
  );
  assert.equal(response.status, 404);
});

test("tracking returns a redacted native commerce projection for a valid capability", async () => {
  const token = await capability("secret", "order_1");
  const response = await handleTrackingRequest(
    new Request(`https://api.example/store/tracking/${encodeURIComponent(token)}`),
    {
      async query<Row>(sql: string) {
        if (sql.includes("tracking_capability_revocations")) return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
        return { rows: [{ id: "order_1", display_id: 42, updated_at: "2026-01-01T00:00:00Z", payment_status: "captured", fulfillment_status: "not_fulfilled", email: "buyer@example.com", metadata: {} }] as Row[], rowCount: 1 };
      },
      async end() {},
    },
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    token,
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { order: { order_number: string; status: string }; shipments: unknown[] };
  assert.deepEqual(body.order, { order_number: "42", status: "paid", updated_at: "2026-01-01T00:00:00Z" });
  assert.deepEqual(body.shipments, []);
});

test("tracking keeps confirmation fields behind a confirmation capability", async () => {
  const confirmationToken = await capability("secret", "order_1", "confirmation");
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/token"),
    {
      async query<Row>(sql: string) {
        if (sql.includes("tracking_capability_revocations")) return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
        return { rows: [{ id: "order_1", display_id: 42, updated_at: "2026-01-01T00:00:00Z", payment_status: "captured", fulfillment_status: "not_fulfilled", email: "buyer@example.com", total: 599700, subtotal: 599700, items: [{ id: "item_1", title: "Canary", quantity: 1, unit_price: 599700 }] , metadata: {} }] as Row[], rowCount: 1 };
      },
      async end() {},
    },
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    confirmationToken,
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { confirmationOrder?: { email?: string; items?: unknown[] } };
  assert.equal(body.confirmationOrder?.email, "buyer@example.com");
  assert.deepEqual(body.confirmationOrder?.items, [{ id: "item_1", title: "Canary", quantity: 1, unit_price: 599700 }]);
});

test("tracking rejects an expired capability", async () => {
  const token = await capability("secret", "order_1", Math.floor(Date.now() / 1000) - 1);
  const database: WorkerDatabaseClient = {
    async query() { throw new Error("database must not be queried"); },
    async end() {},
  };
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/token"),
    database,
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    token,
  );
  assert.equal(response.status, 404);
});
