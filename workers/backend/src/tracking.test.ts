import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleTrackingRequest } from "./tracking.ts";

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function capability(
  secret: string,
  id: string,
  purpose = "track",
  expiresAt = Math.floor(Date.now() / 1000) + 300,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      version: "v3",
      purpose,
      audience: "public-tracking",
      keyVersion: "v1",
      id,
      issuedAt,
      expiresAt,
    }),
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  return [
    "v3",
    "v1",
    String(issuedAt),
    String(expiresAt),
    base64Url(iv),
    base64Url(encrypted.slice(-16)),
    base64Url(encrypted.slice(0, -16)),
  ].join(".");
}

test("tracking rejects invalid capabilities before querying commerce", async () => {
  const database: WorkerDatabaseClient = {
    async query() {
      throw new Error("database must not be queried");
    },
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
  let commerceParams: unknown[] | undefined;
  const response = await handleTrackingRequest(
    new Request(
      `https://api.example/store/tracking/${encodeURIComponent(token)}`,
    ),
    {
      async query<Row>(sql: string, params?: unknown[]) {
        if (sql.includes("tracking_capability_revocations"))
          return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
        commerceParams = params;
        return {
          rows: [
            {
              id: "order_1",
              display_id: 42,
              updated_at: "2026-01-01T00:00:00Z",
              payment_status: "captured",
              fulfillment_status: "not_fulfilled",
              email: "buyer@example.com",
              metadata: {},
            },
          ] as Row[],
          rowCount: 1,
        };
      },
      async end() {},
    },
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    token,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(commerceParams, ["order_1"]);
  const body = (await response.json()) as {
    order: { order_number: string; status: string };
    shipments: unknown[];
  };
  assert.deepEqual(body.order, {
    order_number: "42",
    status: "paid",
    updated_at: "2026-01-01T00:00:00Z",
  });
  assert.deepEqual(body.shipments, []);
});

test("tracking treats a completed payment collection as paid", async () => {
  const token = await capability("secret", "order_completed");
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/token"),
    {
      async query<Row>(sql: string) {
        if (sql.includes("tracking_capability_revocations"))
          return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
        return {
          rows: [
            {
              id: "order_completed",
              display_id: 79,
              updated_at: "2026-09-27T11:04:06.741Z",
              payment_status: "completed",
              fulfillment_status: null,
              email: "buyer@example.com",
              metadata: {},
            },
          ] as Row[],
          rowCount: 1,
        };
      },
      async end() {},
    },
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    token,
  );
  const body = (await response.json()) as { order: { status: string } };
  assert.equal(body.order.status, "paid");
});

test("tracking preserves bounded shipment source and expected delivery metadata", async () => {
  const token = await capability("secret", "order_shipment");
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/token"),
    {
      async query<Row>(sql: string) {
        if (sql.includes("tracking_capability_revocations"))
          return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
        return {
          rows: [{
            id: "order_shipment",
            display_id: 80,
            updated_at: "2026-09-27T11:04:06.741Z",
            payment_status: "captured",
            fulfillment_status: "not_fulfilled",
            email: "buyer@example.com",
            metadata: {
              pancake_pos_expected_delivery: "2026-10-04",
              pancake_pos_shipments: [{ id: "shipment-1", tracking_number: "JT-1", carrier_slug: "jnt" }],
            },
          }] as Row[],
          rowCount: 1,
        };
      },
      async end() {},
    },
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    token,
  );
  const body = (await response.json()) as { shipments: Array<Record<string, unknown>> };
  assert.deepEqual(body.shipments, [{
    id: "shipment-1",
    tracking_number: "JT-1",
    carrier_slug: "jnt",
    source: "jnt",
    expected_delivery: "2026-10-04",
  }]);
});

test("tracking keeps confirmation fields behind a confirmation capability", async () => {
  const confirmationToken = await capability(
    "secret",
    "order_1",
    "confirmation",
  );
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/token"),
    {
      async query<Row>(sql: string) {
        if (sql.includes("tracking_capability_revocations"))
          return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
        return {
          rows: [
            {
              id: "order_1",
              display_id: 42,
              updated_at: "2026-01-01T00:00:00Z",
              payment_status: "captured",
              fulfillment_status: "not_fulfilled",
              email: "buyer@example.com",
              total: 599700,
              subtotal: 599700,
              items: [
                {
                  id: "item_1",
                  title: "Canary",
                  quantity: 1,
                  unit_price: 599700,
                },
              ],
              metadata: {},
            },
          ] as Row[],
          rowCount: 1,
        };
      },
      async end() {},
    },
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    confirmationToken,
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    confirmationOrder?: { email?: string; items?: unknown[] };
  };
  assert.equal(body.confirmationOrder?.email, "buyer@example.com");
  assert.deepEqual(body.confirmationOrder?.items, [
    { id: "item_1", title: "Canary", quantity: 1, unit_price: 599700 },
  ]);
});

test("tracking reads revocations from APP and orders from commerce", async () => {
  const token = await capability("secret", "order_1");
  const appQueries: string[] = [];
  const commerceQueries: string[] = [];
  const appDatabase: WorkerDatabaseClient = {
    async query<Row>(sql: string) {
      appQueries.push(sql);
      return { rows: [], rowCount: 0 } as { rows: Row[]; rowCount: number };
    },
    async end() {},
  };
  const commerceDatabase: WorkerDatabaseClient = {
    async query<Row>(sql: string) {
      commerceQueries.push(sql);
      return {
        rows: [
          {
            id: "order_1",
            display_id: 42,
            updated_at: "2026-01-01T00:00:00Z",
            payment_status: "captured",
            fulfillment_status: "not_fulfilled",
            email: "buyer@example.com",
            metadata: {},
          },
        ],
        rowCount: 1,
      } as { rows: Row[]; rowCount: number };
    },
    async end() {},
  };
  const response = await handleTrackingRequest(
    new Request("https://api.example/store/tracking/token"),
    appDatabase,
    { TRACKING_HMAC_SECRET: "secret", TRACKING_HMAC_KEY_VERSION: "v1" },
    token,
    commerceDatabase,
  );
  assert.equal(response.status, 200);
  assert.ok(
    appQueries.some((sql) => sql.includes("tracking_capability_revocations")),
  );
  assert.ok(commerceQueries.some((sql) => sql.includes('FROM public."order"')));
});

test("tracking rejects an expired capability", async () => {
  const token = await capability(
    "secret",
    "order_1",
    Math.floor(Date.now() / 1000) - 1,
  );
  const database: WorkerDatabaseClient = {
    async query() {
      throw new Error("database must not be queried");
    },
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
