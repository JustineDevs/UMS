import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import {
  handleChannelEventListRequest,
  handleChannelEventProcessRequest,
  handleChannelWebhookRequest,
} from "./channel-events-admin.ts";

function b64(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function token(claims: Record<string, unknown>): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff-1", exp: 2_000_000_000, ...claims });
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)));
  return `${input}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

async function webhookRequest(payload: unknown, nonce: string, tenant = "store-a", timestamp = String(Math.floor(Date.now() / 1000)), secret = "channel-secret") {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new TextEncoder().encode(`${timestamp}.${tenant}:${body}`);
  const signature = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, signed))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://worker.test/api/integrations/channels/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-key": tenant, "x-channel-timestamp": timestamp, "x-channel-signature": `sha256=${signature}`, "x-channel-nonce": nonce },
    body,
  });
}

const webhookEnv = { CHANNEL_WEBHOOK_SECRET: "channel-secret", CHANNEL_TENANT_KEY: "store-a", CHANNEL_ALLOWED_IDS: "market-a,market-b" };

test("channel webhook persists signed events once and returns duplicate payload idempotently", async () => {
  const events = new Set<string>();
  const nonces = new Set<string>();
  const calls: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      calls.push(sql);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] as T[], rowCount: 0 };
      if (sql.includes("admin_webhook_replays")) {
        const replayKey = `${values[0]}:${values[1]}`;
        if (nonces.has(replayKey)) return { rows: [] as T[], rowCount: 0 };
        nonces.add(replayKey);
        return { rows: [{ id: "replay-1" } as T], rowCount: 1 };
      }
      if (sql.includes("channel_sync_events")) {
        const eventKey = `${values[0]}:${values[1]}:${values[4]}`;
        if (events.has(eventKey)) return { rows: [] as T[], rowCount: 0 };
        events.add(eventKey);
        return { rows: [{ id: "event-1" } as T], rowCount: 1 };
      }
      throw new Error(`unexpected_sql:${sql}`);
    },
    async end() {},
  };
  const payload = { channel: "market-a", event_type: "order.updated", order_id: "remote-7" };
  const first = await handleChannelWebhookRequest(await webhookRequest(payload, "nonce-000000000001"), database, webhookEnv);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });
  const duplicate = await handleChannelWebhookRequest(await webhookRequest(payload, "nonce-000000000002"), database, webhookEnv);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { ok: true, deduplicated: true });
  assert.equal(calls.filter((sql) => sql.includes("channel_sync_events")).length, 2);
  assert.equal(calls.filter((sql) => sql === "COMMIT").length, 2);
});

test("channel webhook rejects bad signatures, stale timestamps, tenant mismatch, and replayed nonces", async () => {
  const nonces = new Set<string>();
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] as T[], rowCount: 0 };
      if (sql.includes("admin_webhook_replays")) {
        const key = `${values[0]}:${values[1]}`;
        if (nonces.has(key)) return { rows: [] as T[], rowCount: 0 };
        nonces.add(key);
        return { rows: [{ id: "r" } as T], rowCount: 1 };
      }
      if (sql.includes("channel_sync_events")) return { rows: [{ id: "e" } as T], rowCount: 1 };
      throw new Error(`unexpected_sql:${sql}`);
    },
    async end() {},
  };
  const payload = { channel: "market-a" };
  const request = await webhookRequest(payload, "nonce-000000000003");
  const headers = new Headers(request.headers);
  headers.set("x-channel-signature", "0".repeat(64));
  assert.equal((await handleChannelWebhookRequest(new Request(request.url, { method: "POST", headers, body: JSON.stringify(payload) }), database, webhookEnv)).status, 401);
  assert.equal((await handleChannelWebhookRequest(await webhookRequest(payload, "nonce-000000000004", "store-b"), database, webhookEnv)).status, 403);
  assert.equal((await handleChannelWebhookRequest(await webhookRequest(payload, "nonce-000000000005", "store-a", "1"), database, webhookEnv)).status, 401);
  const valid = await webhookRequest(payload, "nonce-000000000006");
  assert.equal((await handleChannelWebhookRequest(valid, database, webhookEnv)).status, 200);
  assert.equal((await handleChannelWebhookRequest(await webhookRequest(payload, "nonce-000000000006"), database, webhookEnv)).status, 409);
});

test("channel webhook validates body size, tenant scope, channel allowlist, and nested dangerous keys", async () => {
  const database = { query: async () => { throw new Error("invalid input must not touch database"); }, end: async () => {} } as unknown as WorkerDatabaseClient;
  assert.equal((await handleChannelWebhookRequest(await webhookRequest({ channel: "market-a" }, "nonce-000000000007"), database, { ...webhookEnv, CHANNEL_WEBHOOK_SECRET: "" })).status, 503);
  assert.equal((await handleChannelWebhookRequest(await webhookRequest({ channel: "market-a" }, "nonce-000000000008"), database, { ...webhookEnv, CHANNEL_TENANT_KEY: "" })).status, 503);
  assert.equal((await handleChannelWebhookRequest(await webhookRequest({ channel: "not-allowed" }, "nonce-000000000009"), database, webhookEnv)).status, 403);
  assert.equal((await handleChannelWebhookRequest(await webhookRequest({ nested: { constructor: { polluted: true } } }, "nonce-000000000010"), database, webhookEnv)).status, 400);
  const body = "x".repeat(512_001);
  assert.equal((await handleChannelWebhookRequest(new Request("https://worker.test", { method: "POST", headers: { "content-length": String(body.length), "x-tenant-key": "store-a" }, body }), database, webhookEnv)).status, 413);
});

test("channel event list enforces staff permission and filters by configured tenant", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [{ id: "event-1", channel: "market-a", event_type: "order.updated", received_at: "2026-09-20T00:00:00Z", processed_at: null } as T], rowCount: 1 };
    },
    async end() {},
  };
  const unauthorized = await token({ permissions: ["orders:read"] });
  assert.equal((await handleChannelEventListRequest(new Request("https://worker.test/api/admin/channels/events", { headers: { Authorization: `Bearer ${unauthorized}` } }), database, { ...webhookEnv, CMS_ADMIN_JWT_SECRET: "test-secret" })).status, 403);
  const allowed = await token({ permissions: ["channels:manage"], organization_id: "org-a" });
  const response = await handleChannelEventListRequest(new Request("https://worker.test/api/admin/channels/events?limit=999", { headers: { Authorization: `Bearer ${allowed}` } }), database, { ...webhookEnv, CMS_ADMIN_JWT_SECRET: "test-secret" });
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0]?.values, ["store-a", 100]);
  assert.match(calls[0]?.sql ?? "", /tenant_key = \$1/);
});

test("channel event processing is permission-gated, tenant-scoped, and idempotent", async () => {
  const id = "8c4b85ee-4a78-4b9f-a41f-15a69df3221a";
  const queries: string[] = [];
  const idempotency = new Map<string, { state: string; request_hash: string; response_status: number; response_headers: Array<[string, string]>; response_body: string; created_at: string }>();
  let processed = false;
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      queries.push(sql);
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
        const key = String(values[0]);
        if (idempotency.has(key)) return { rows: [] as T[], rowCount: 0 };
        idempotency.set(key, { state: "pending", request_hash: String(values[1]), response_status: 102, response_headers: [], response_body: "", created_at: new Date().toISOString() });
        return { rows: [{ state: "pending", request_hash: values[1] } as T], rowCount: 1 };
      }
      if (sql.includes("FROM public.worker_idempotency_records WHERE idempotency_key")) {
        const record = idempotency.get(String(values[0]));
        return { rows: (record ? [{ idempotency_key: values[0], ...record }] : []) as T[], rowCount: record ? 1 : 0 };
      }
      if (sql.includes("SET state = 'completed'")) {
        const current = idempotency.get(String(values[0]))!;
        idempotency.set(String(values[0]), { ...current, state: "completed", response_status: Number(values[2]), response_headers: JSON.parse(String(values[3])) as Array<[string, string]>, response_body: String(values[4]) });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM public.worker_idempotency_records")) {
        idempotency.delete(String(values[0]));
        return { rows: [] as T[], rowCount: 1 };
      }
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] as T[], rowCount: 0 };
      if (sql.includes("UPDATE public.channel_sync_events")) {
        assert.deepEqual(values, [id, "store-a"]);
        if (processed) return { rows: [] as T[], rowCount: 0 };
        processed = true;
        return { rows: [{ id, processed_at: "2026-09-20T00:00:00Z" } as T], rowCount: 1 };
      }
      if (sql.includes("SELECT id, processed_at FROM public.channel_sync_events")) {
        assert.deepEqual(values, [id, "store-a"]);
        return { rows: (processed ? [{ id, processed_at: "2026-09-20T00:00:00Z" } as T] : []) as T[], rowCount: processed ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO public.audit_logs")) return { rows: [] as T[], rowCount: 1 };
      throw new Error(`unexpected_sql:${sql}`);
    },
    async end() {},
  };
  const bearer = await token({ permissions: ["channels:manage"], organization_id: "org-a" });
  const makeRequest = () => new Request(`https://worker.test/api/admin/channels/events/${id}/process`, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "channel-process-1" } });
  const env = { ...webhookEnv, CMS_ADMIN_JWT_SECRET: "test-secret" };
  const first = await handleChannelEventProcessRequest(makeRequest(), database, env, id);
  assert.equal(first.status, 200);
  assert.equal((await first.json() as { event: { id: string } }).event.id, id);
  const second = await handleChannelEventProcessRequest(makeRequest(), database, env, id);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("Idempotency-Replayed"), "true");
  const repeated = await handleChannelEventProcessRequest(new Request(`https://worker.test/api/admin/channels/events/${id}/process`, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "channel-process-2" } }), database, env, id);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json() as { event: { alreadyProcessed: boolean } }).event.alreadyProcessed, true);
  assert.equal(queries.filter((sql) => sql.includes("UPDATE public.channel_sync_events")).length, 2);
  assert.equal(queries.filter((sql) => sql.includes("INSERT INTO public.audit_logs")).length, 1);
});
