import assert from "node:assert/strict";
import test from "node:test";
import {
  executeIdempotently,
  HyperdriveIdempotencyStore,
  KvIdempotencyStore,
  type IdempotencyRecord,
  type IdempotencyStore,
} from "./idempotency.ts";

class MemoryStore implements IdempotencyStore {
  records = new Map<string, IdempotencyRecord>();
  released: string[] = [];

  async get(key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(key) ?? null;
  }

  async put(record: IdempotencyRecord): Promise<void> {
    if (this.records.has(record.key)) throw new Error("atomic_claim_lost");
    this.records.set(record.key, record);
  }

  async release(key: string, _requestHash: string): Promise<void> {
    this.released.push(key);
    this.records.delete(key);
  }
}

test("executes once and replays the stored response", async () => {
  const store = new MemoryStore();
  let calls = 0;
  const first = await executeIdempotently(
    store,
    "checkout-1",
    "hash-a",
    async () => {
      calls += 1;
      return new Response(JSON.stringify({ orderId: "order-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  const second = await executeIdempotently(
    store,
    "checkout-1",
    "hash-a",
    async () => {
      calls += 1;
      return new Response("should-not-run");
    },
  );

  assert.equal(first.kind, "executed");
  assert.equal(second.kind, "replayed");
  assert.equal(calls, 1);
  assert.equal(second.response.status, 201);
  assert.equal(second.response.headers.get("Idempotency-Replayed"), "true");
  assert.deepEqual(await second.response.json(), { orderId: "order-1" });
});

test("rejects reuse of a key for a different request", async () => {
  const store = new MemoryStore();
  await executeIdempotently(
    store,
    "checkout-2",
    "hash-a",
    async () => new Response("created", { status: 201 }),
  );
  const result = await executeIdempotently(
    store,
    "checkout-2",
    "hash-b",
    async () => new Response("should-not-run"),
  );

  assert.equal(result.kind, "conflict");
  assert.equal(result.response.status, 409);
  assert.deepEqual(await result.response.json(), {
    error: "idempotency_key_reused",
  });
});

test("does not store a failed operation", async () => {
  const store = new MemoryStore();
  await assert.rejects(
    () =>
      executeIdempotently(store, "checkout-3", "hash-a", async () => {
        throw new Error("provider_failed");
      }),
    /provider_failed/,
  );
  assert.equal(store.records.size, 0);
});

test("releases transient responses so the same request can retry", async () => {
  const store = new MemoryStore();
  let calls = 0;
  const first = await executeIdempotently(store, "retry-1", "hash-a", async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), { status: 503 });
  });
  const second = await executeIdempotently(store, "retry-1", "hash-a", async () => {
    calls += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  assert.equal(first.kind, "executed");
  assert.equal(second.kind, "executed");
  assert.equal(calls, 2);
  assert.equal(store.records.get("retry-1")?.status, 200);
  assert.deepEqual(await second.response.json(), { ok: true });
});

test("rejects empty and oversized keys before running the operation", async () => {
  const store = new MemoryStore();
  let calls = 0;
  await assert.rejects(
    () =>
      executeIdempotently(store, " ", "hash", async () => {
        calls += 1;
        return new Response("never");
      }),
    /invalid_idempotency_key/,
  );
  await assert.rejects(
    () =>
      executeIdempotently(store, "x".repeat(256), "hash", async () => {
        calls += 1;
        return new Response("never");
      }),
    /invalid_idempotency_key/,
  );
  assert.equal(calls, 0);
});

test("persists records through the Worker KV contract with a bounded TTL", async () => {
  const values = new Map<string, string>();
  let ttl = 0;
  const store = new KvIdempotencyStore(
    {
      async get<T>(key: string): Promise<T | null> {
        const value = values.get(key);
        return value ? (JSON.parse(value) as T) : null;
      },
      async put(
        key: string,
        value: string,
        options?: { expirationTtl?: number },
      ): Promise<void> {
        values.set(key, value);
        ttl = options?.expirationTtl ?? 0;
      },
    },
    3_600,
  );
  const result = await executeIdempotently(
    store,
    "kv-1",
    "hash",
    async () => new Response("stored", { status: 202 }),
  );

  assert.equal(result.kind, "executed");
  assert.equal(ttl, 3_600);
  assert.equal(
    (
      await executeIdempotently(
        store,
        "kv-1",
        "hash",
        async () => new Response("bad"),
      )
    ).kind,
    "replayed",
  );
});

test("uses an atomic Hyperdrive insert and restores a stored response", async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const store = new HyperdriveIdempotencyStore({
    async query<Row>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<{ rows: Row[]; rowCount: number }> {
      calls.push({ text, values });
      if (text.startsWith("SELECT")) {
        return {
          rows: [
            {
              idempotency_key: "db-1",
              request_hash: "hash",
              response_status: 201,
              response_headers: [["content-type", "application/json"]],
              response_body: '{"ok":true}',
              created_at: new Date(1_700_000_000_000).toISOString(),
            },
          ] as Row[],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    },
  });
  const existing = await store.get("db-1");
  await store.put({
    key: "db-1",
    requestHash: "hash",
    status: 201,
    headers: [],
    body: "{}",
    createdAt: 1_700_000_000_000,
  });

  assert.equal(existing?.status, 201);
  assert.match(calls[0]?.text ?? "", /expires_at > now/);
  assert.match(calls[1]?.text ?? "", /SET state = 'completed'/);
  assert.match(calls[1]?.text ?? "", /state = 'pending'/);
  assert.equal(calls[1]?.values[6], 86_400);
});
