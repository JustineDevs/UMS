import assert from "node:assert/strict";
import test from "node:test";
import { handleWorkerCronRequest, runBackInStockSweep, runPaymentFinalizationSweep, runReservationExpirySweep } from "./cron.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function database(responder: (_sql: string, _values: readonly unknown[]) => Record<string, unknown>[] = () => []): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      const rows = responder(sql, values) as T[];
      return { rows, rowCount: rows.length };
    },
    async end() {},
  };
}

test("cron endpoint rejects missing and incorrect credentials before opening databases", async () => {
  const request = new Request("https://worker.test/internal/cron/inventory-reservations");
  assert.equal((await handleWorkerCronRequest(request, {})).status, 401);
  assert.equal((await handleWorkerCronRequest(new Request(request, { headers: { Authorization: "Bearer wrong" } }), { CRON_SECRET: "secret" })).status, 401);
});

test("cron endpoint restricts methods and task names", async () => {
  const env = { CRON_SECRET: "secret" };
  const headers = { Authorization: "Bearer secret" };
  assert.equal((await handleWorkerCronRequest(new Request("https://worker.test/internal/cron/inventory-reservations", { method: "POST", headers }), env)).status, 405);
  assert.equal((await handleWorkerCronRequest(new Request("https://worker.test/internal/cron/unknown", { headers }), env)).status, 404);
});

test("campaign cron dispatch is Worker-owned and fails closed without APP Hyperdrive", async () => {
  const response = await handleWorkerCronRequest(
    new Request("https://worker.test/internal/cron/campaigns", { headers: { Authorization: "Bearer secret" } }),
    { CRON_SECRET: "secret" },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cron_task_unavailable" });
});

test("payment reconciliation cron is Worker-owned and requires APP Hyperdrive", async () => {
  const response = await handleWorkerCronRequest(
    new Request("https://worker.test/internal/cron/payment-reconciliation", { headers: { Authorization: "Bearer secret" } }),
    { CRON_SECRET: "secret" },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "cron_task_unavailable" });
});

test("reservation sweep expires only tenants with currently due active reservations", async () => {
  const calls: string[] = [];
  const app = database((sql, values) => {
    calls.push(sql);
    if (sql.includes("SELECT DISTINCT tenant_id")) return [{ tenant_id: "org-a" }, { tenant_id: "org-b" }];
    assert.equal(sql, "SELECT public.inventory_reservation_expire_due($1,$2)::integer AS count");
    return [{ count: values[0] === "org-a" ? 2 : 1 }];
  });
  const result = await runReservationExpirySweep(app);
  assert.deepEqual(result, { processed: 2, expired: 3 });
  assert.equal(calls.length, 3);
});

test("finalization sweep processes a bounded set and reports failures without leaking provider errors", async () => {
  const app = database((sql) => {
    assert.match(sql, /FROM public\.payment_attempts/);
    assert.match(sql, /LIMIT 25/);
    return [{ correlation_id: "00000000-0000-4000-8000-000000000001" }, { correlation_id: "00000000-0000-4000-8000-000000000002" }];
  });
  const commerce = database();
  const finalized: string[] = [];
  const result = await runPaymentFinalizationSweep(app, commerce, async (_app, _commerce, correlationId) => {
    finalized.push(correlationId);
    if (finalized.length === 2) throw new Error("provider secret should not be returned");
    return { orderId: "order-1", replayed: false };
  });
  assert.deepEqual(result, {
    ok: true,
    processed: 2,
    completed: 1,
    errors: ["00000000-0000-4000-8000-000000000002:finalization_failed"],
  });
  assert.equal(finalized.length, 2);
});

test("back-in-stock only sends for the exact published product variant with positive stock", async () => {
  const statements: string[] = [];
  const app = database((sql) => {
    statements.push(sql);
    if (sql.startsWith("SELECT id::text, email, product_id")) return [
      { id: "sub-in-stock", email: "buyer@example.test", product_id: "prod-1", product_slug: "canary", variant_id: "variant-in" },
      { id: "sub-out-of-stock", email: "buyer2@example.test", product_id: "prod-1", product_slug: "canary", variant_id: "variant-out" },
    ];
    if (sql.startsWith("INSERT INTO public.public_delivery_attempts")) return [{ id: "attempt-1", status: "queued", next_attempt_at: null }];
    if (sql.startsWith("UPDATE public.public_delivery_attempts") && sql.includes("attempts=attempts+1")) return [{ id: "attempt-1", attempts: 1 }];
    if (sql.startsWith("SELECT EXISTS")) return [{ found: false }];
    return [];
  });
  const commerce = database(() => [{
    id: "prod-1", title: "Canary", handle: "canary", subtitle: null, description: null,
    thumbnail: null, status: "published", collection_id: null, created_at: null, metadata: null,
    variants: [
      { id: "variant-in", title: "In stock", inventory_quantity: 2 },
      { id: "variant-out", title: "Sold out", inventory_quantity: 0 },
    ], total_count: 1,
  }]);
  const requests: Request[] = [];
  const result = await runBackInStockSweep(app, commerce, { RESEND_API_KEY: "test-key" }, async (input, init) => {
    requests.push(new Request(input, init));
    return Response.json({ id: "resend-1" });
  });
  assert.deepEqual(result, { ok: true, inspected: 2, sent: 1, failed: 0 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers.get("Idempotency-Key"), "back_in_stock:sub-in-stock");
  assert.equal(statements.filter((sql) => sql.startsWith("UPDATE public.back_in_stock_notifications")).length, 1);
  const claim = statements.find((sql) => sql.startsWith("UPDATE public.public_delivery_attempts"));
  assert.match(claim ?? "", /status IN \('queued','retry','failed'\)/);
  assert.match(claim ?? "", /attempts < 8/);
  assert.match(claim ?? "", /next_attempt_at IS NULL OR next_attempt_at <= now\(\)/);
});

test("back-in-stock suppresses unsubscribed recipients without sending", async () => {
  const app = database((sql) => {
    if (sql.startsWith("SELECT id::text, email, product_id")) return [{ id: "sub-1", email: "buyer@example.test", product_id: "prod-1", product_slug: "canary", variant_id: null }];
    if (sql.startsWith("INSERT INTO public.public_delivery_attempts")) return [{ id: "attempt-1", status: "queued", next_attempt_at: null }];
    if (sql.startsWith("UPDATE public.public_delivery_attempts") && sql.includes("attempts=attempts+1")) return [{ id: "attempt-1", attempts: 1 }];
    if (sql.startsWith("SELECT EXISTS")) return [{ found: true }];
    return [];
  });
  const commerce = database(() => [{ id: "prod-1", title: "Canary", handle: "canary", status: "published", variants: [{ id: "variant-in", inventory_quantity: 2 }], total_count: 1 }]);
  let sends = 0;
  const result = await runBackInStockSweep(app, commerce, { RESEND_API_KEY: "test-key" }, async () => { sends += 1; return Response.json({ id: "unexpected" }); });
  assert.deepEqual(result, { ok: true, inspected: 1, sent: 0, failed: 0 });
  assert.equal(sends, 0);
});

test("overlapping back-in-stock sweeps atomically claim one delivery", async () => {
  let claimed = false;
  let sends = 0;
  const app = database((sql) => {
    if (sql.startsWith("SELECT id::text, email, product_id")) return [{ id: "sub-1", email: "buyer@example.test", product_id: "prod-1", product_slug: "canary", variant_id: null }];
    if (sql.startsWith("INSERT INTO public.public_delivery_attempts")) return [{ id: "attempt-1", status: "queued" }];
    if (sql.startsWith("UPDATE public.public_delivery_attempts") && sql.includes("attempts=attempts+1")) {
      if (claimed) return [];
      claimed = true;
      return [{ id: "attempt-1", attempts: 1 }];
    }
    if (sql.startsWith("SELECT EXISTS")) return [{ found: false }];
    return [];
  });
  const commerce = database(() => [{
    id: "prod-1", title: "Canary", handle: "canary", status: "published",
    variants: [{ id: "variant-in", inventory_quantity: 2 }], total_count: 1,
  }]);
  const fetcher: typeof fetch = async () => {
    sends += 1;
    await Promise.resolve();
    return Response.json({ id: "resend-1" });
  };

  const results = await Promise.all([
    runBackInStockSweep(app, commerce, { RESEND_API_KEY: "test-key" }, fetcher),
    runBackInStockSweep(app, commerce, { RESEND_API_KEY: "test-key" }, fetcher),
  ]);

  assert.equal(sends, 1);
  assert.equal(results.reduce((total, result) => total + result.sent, 0), 1);
});
