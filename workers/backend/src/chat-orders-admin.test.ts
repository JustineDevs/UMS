import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import {
  handleChatOrderIntake,
  handleChatOrderList,
  handleChatOrderStatus,
} from "./chat-orders-admin.ts";

const env = { JWT_SECRET: "secret" };
function token(role = "admin") {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "staff",
    role,
    organization_id: "org-a",
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  return `${header}.${payload}.${createHmac("sha256", env.JWT_SECRET).update(`${header}.${payload}`).digest("base64url")}`;
}
function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token()}`);
  return new Request(`https://worker.test${path}`, { ...init, headers });
}
function appDatabase() {
  const queries: Array<{ sql: string; values: readonly unknown[] }> = [];
  const idempotency = new Map<
    string,
    {
      hash: string;
      state: string;
      status: number;
      headers: Array<[string, string]>;
      body: string;
      expiresAt: number;
    }
  >();
  const client: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(
      sql: string,
      values: readonly unknown[] = [],
    ) {
      queries.push({ sql, values });
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
        const [key, hash, _createdAt, ttl] = values as [
          string,
          string,
          number,
          number,
        ];
        const row = idempotency.get(key);
        if (!row || row.expiresAt <= Date.now()) {
          idempotency.set(key, {
            hash,
            state: "pending",
            status: 102,
            headers: [],
            body: "",
            expiresAt: Date.now() + ttl * 1000,
          });
          return {
            rows: [{ state: "pending", request_hash: hash }] as T[],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith("UPDATE public.worker_idempotency_records")) {
        const [key, hash, status, headers, body, createdAt, ttl] = values as [
          string,
          string,
          number,
          string,
          string,
          number,
          number,
        ];
        const row = idempotency.get(key);
        if (row?.hash === hash && row.state === "pending") {
          Object.assign(row, {
            state: "completed",
            status,
            headers: JSON.parse(headers),
            body,
            expiresAt: createdAt + ttl * 1000,
          });
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith("DELETE FROM public.worker_idempotency_records")) {
        const [key, hash] = values as [string, string];
        const row = idempotency.get(key);
        if (row?.hash === hash && row.state === "pending")
          idempotency.delete(key);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM public.worker_idempotency_records")) {
        const row = idempotency.get(String(values[0]));
        if (row && row.expiresAt > Date.now())
          return {
            rows: [
              {
                idempotency_key: values[0],
                request_hash: row.hash,
                state: row.state,
                response_status: row.status,
                response_headers: row.headers,
                response_body: row.body,
                created_at: new Date().toISOString(),
              },
            ] as T[],
            rowCount: 1,
          };
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT id,commerce_cart_id,status"))
        return { rows: [], rowCount: 0 };
      if (
        sql.includes(
          "SELECT status,commerce_cart_id FROM public.chat_order_intake",
        )
      ) {
        return {
          rows: [
            { status: "draft_created", commerce_cart_id: "cart_test" },
          ] as T[],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE public.chat_order_intake"))
        return {
          rows: [
            {
              status: values[2] ?? "draft_created",
              commerce_cart_id: "cart_test",
            },
          ] as T[],
          rowCount: 1,
        };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  return { client, queries };
}
function commerceDatabase() {
  const queries: string[] = [];
  const client: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string) {
      queries.push(sql);
      if (sql.includes("SELECT c.id AS cart_id"))
        return {
          rows: [
            {
              cart_id: "cart_test",
              currency_code: "php",
              product_id: "prod_1",
              product_title: "Guitar",
              product_handle: "guitar",
              product_description: null,
              thumbnail: null,
              variant_id: "variant_1",
              variant_title: "Default",
              variant_sku: "GTR-1",
              allow_backorder: false,
              unit_price: 5000,
              available_quantity: 3,
            },
          ] as T[],
          rowCount: 1,
        };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  return { client, queries };
}

test("chat order listing is tenant-scoped and bounded", async () => {
  const app = appDatabase();
  const response = await handleChatOrderList(
    request("/api/admin/chat-orders?limit=1000"),
    app.client,
    env,
  );
  assert.equal(response.status, 200);
  assert.match(app.queries[0].sql, /WHERE organization_id=\$1/);
  assert.deepEqual(app.queries[0].values, ["org-a", 100]);
});

test("chat intake persists a tenant ticket and creates a catalog-backed Worker cart", async () => {
  const app = appDatabase();
  const commerce = commerceDatabase();
  const response = await handleChatOrderIntake(
    request("/api/integrations/chat-orders/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "chat-intake-001",
      },
      body: JSON.stringify({
        source: "manual",
        phone: "09170000000",
        items: [{ variantId: "variant_1", quantity: 2 }],
      }),
    }),
    app.client,
    commerce.client,
    env,
  );
  assert.equal(response.status, 201);
  const body = (await response.json()) as {
    id: string;
    draftOrderId: string;
    status: string;
  };
  assert.match(body.id, /^[0-9a-f-]{36}$/i);
  assert.match(body.draftOrderId, /^cart_/);
  assert.equal(body.status, "draft_created");
  assert.ok(
    app.queries.some(
      ({ sql, values }) =>
        sql.includes("INSERT INTO public.chat_order_intake") &&
        values[1] === "org-a",
    ),
  );
  assert.ok(
    commerce.queries.some((sql) =>
      sql.includes("INSERT INTO public.cart_line_item"),
    ),
  );
});

test("chat intake refuses missing replay keys and unsafe completion transitions", async () => {
  const app = appDatabase();
  const commerce = commerceDatabase();
  const missingKey = await handleChatOrderIntake(
    request("/api/integrations/chat-orders/intake", {
      method: "POST",
      body: JSON.stringify({ items: [{ variantId: "v", quantity: 1 }] }),
    }),
    app.client,
    commerce.client,
    env,
  );
  assert.equal(missingKey.status, 400);
  const complete = await handleChatOrderStatus(
    request("/api/admin/chat-orders/ticket/status", {
      method: "POST",
      headers: { "Idempotency-Key": "status-key-001" },
      body: JSON.stringify({ status: "completed" }),
    }),
    app.client,
    commerce.client,
    env,
    "ticket",
  );
  assert.equal(complete.status, 409);
  assert.equal(app.queries.length, 0);
});

test("chat intake redacts commerce provider errors while recording a failed ticket", async () => {
  const app = appDatabase();
  const secret = "postgres://user:password@internal/database";
  const commerce: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(): Promise<{
      rows: T[];
      rowCount: number;
    }> {
      throw new Error(secret);
    },
    async end() {},
  };
  const response = await handleChatOrderIntake(
    request("/api/integrations/chat-orders/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "chat-error-001",
      },
      body: JSON.stringify({
        source: "manual",
        items: [{ variantId: "variant_1", quantity: 1 }],
      }),
    }),
    app.client,
    commerce,
    env,
  );
  const body = await response.text();
  assert.equal(response.status, 422);
  assert.deepEqual(JSON.parse(body).error, "chat_cart_creation_failed");
  assert.doesNotMatch(
    body,
    new RegExp(secret.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")),
  );
  assert.ok(app.queries.some(({ sql }) => sql.includes("status='failed'")));
});

test("chat status mutation durably replays the same result without repeating the state change", async () => {
  const app = appDatabase();
  const commerce = commerceDatabase();
  const makeRequest = () =>
    request("/api/admin/chat-orders/ticket/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "chat-status-001",
      },
      body: JSON.stringify({ status: "processing" }),
    });

  const first = await handleChatOrderStatus(
    makeRequest(),
    app.client,
    commerce.client,
    env,
    "ticket",
  );
  const replay = await handleChatOrderStatus(
    makeRequest(),
    app.client,
    commerce.client,
    env,
    "ticket",
  );

  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.deepEqual(await replay.json(), await first.json());
  assert.equal(
    app.queries.filter(({ sql }) =>
      sql.startsWith("UPDATE public.chat_order_intake SET status='processing'"),
    ).length,
    1,
  );
});

test("chat order APIs reject missing staff identity", async () => {
  const noAuth = new Request("https://worker.test/api/admin/chat-orders");
  assert.equal(
    (await handleChatOrderList(noAuth, appDatabase().client, env)).status,
    401,
  );
});
