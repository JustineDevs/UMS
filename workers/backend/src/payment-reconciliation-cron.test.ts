import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { runPaymentReconciliationSweep } from "./payment-reconciliation-cron.ts";

type Options = { connected?: boolean; connectionCount?: number; attempts?: boolean; attemptStatus?: string; provider?: "stripe" | "paypal" | "xendit"; payload?: unknown };
function fixture(options: Options = {}) {
  const provider = options.provider ?? "stripe";
  const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      statements.push({ sql, values });
      let rows: Record<string, unknown>[] = [];
      if (sql.includes("WITH candidate AS") && sql.includes("reconcile_payment")) rows = [{ id: "job-1", attempts: 1, payload: options.payload ?? { organizationId: "org-1", provider, periodStart: "2026-09-01T00:00:00.000Z", periodEnd: "2026-09-02T00:00:00.000Z", idempotencyKey: "reconcile-001" } }];
      else if (sql.includes("FROM public.payment_nango_connections")) rows = options.connected === false ? [] : Array.from({ length: options.connectionCount ?? 1 }, (_, index) => ({ provider_config_key: `${provider}-sandbox`, nango_connection_id: `conn-${index + 1}`, merchant_identity: `merchant-${index + 1}@example.test` }));
      else if (sql.includes("FROM public.payment_attempts")) rows = options.attempts === false ? [] : [{ correlation_id: "attempt-1", order_id: "order-1", medusa_order_id: "order-1", provider_session_id: "cs_1", provider_payment_id: "pi_1", status: options.attemptStatus ?? "paid", amount_minor: 50000, currency: "PHP" }];
      return { rows: rows as T[], rowCount: rows.length };
    },
    async end() {},
  };
  return { database, statements };
}

const chargeReport = {
  has_more: false,
  data: [{
    id: "ch_1", payment_intent: "pi_1", paid: true, amount: 50000, amount_captured: 50000,
    currency: "php", status: "succeeded", created: 1_788_240_000,
    balance_transaction: { id: "txn_1", fee: 1500, net: 48500 },
    metadata: { order_id: "order-1" },
  }],
};

test("pulls Stripe data through the tenant's Nango connection and persists a matched settlement", async () => {
  const { database, statements } = fixture();
  let requestUrl = ""; let requestHeaders: Headers | undefined;
  const result = await runPaymentReconciliationSweep(database, {
    NANGO_API_KEY: "nango-secret",
    fetch: async (input, init) => { requestUrl = String(input); requestHeaders = new Headers(init?.headers); return Response.json(chargeReport); },
  });
  assert.equal(result.processed, 1);
  assert.equal(result.result?.provider_api_pull, true);
  assert.equal(result.result?.status, "matched");
  assert.match(requestUrl, /^https:\/\/api\.nango\.dev\/proxy\/v1\/charges\?/);
  assert.equal(requestHeaders?.get("Connection-Id"), "conn-1");
  assert.equal(requestHeaders?.get("Provider-Config-Key"), "stripe-sandbox");
  const persisted = statements.find(({ sql }) => sql.includes("INSERT INTO public.payment_settlement_records"));
  assert.ok(persisted);
  assert.equal(persisted.values[10], "matched");
  assert.equal(persisted.values[6], 50000);
  assert.ok(statements.some(({ sql }) => sql.includes("UPDATE public.background_jobs SET status='completed'")));
});

test("does not call a provider or claim matched when a connection is missing", async () => {
  const { database, statements } = fixture({ connected: false });
  let called = false;
  const result = await runPaymentReconciliationSweep(database, { NANGO_API_KEY: "configured", fetch: async () => { called = true; return Response.json({}); } });
  assert.equal(called, false);
  assert.deepEqual(result, { processed: 1, failed: true });
  assert.ok(statements.some(({ sql }) => sql.includes("SET status='queued'")));
  assert.equal(statements.some(({ sql }) => sql.includes("SET status='completed'")), false);
});

test("does not report matched when provider rows cannot match a local attempt", async () => {
  const { database, statements } = fixture({ attempts: false });
  const result = await runPaymentReconciliationSweep(database, { NANGO_API_KEY: "configured", fetch: async () => Response.json(chargeReport) });
  assert.equal(result.result?.status, "review");
  const persisted = statements.find(({ sql }) => sql.includes("INSERT INTO public.payment_settlement_records"));
  assert.ok(persisted);
  assert.equal(persisted.values[10], "needs_review");
});

test("retries provider HTTP errors without persisting a fabricated report", async () => {
  const { database, statements } = fixture();
  const result = await runPaymentReconciliationSweep(database, { NANGO_API_KEY: "configured", fetch: async () => new Response("provider down", { status: 503 }) });
  assert.deepEqual(result, { processed: 1, failed: true });
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO public.payment_settlement_records")), false);
  assert.ok(statements.some(({ sql }) => sql.includes("SET status='queued'") && sql.includes("next_run_at")));
});

test("PayPal success code and total_pages are interpreted using the provider contract", async () => {
  const { database } = fixture({ provider: "paypal" });
  const pages: string[] = [];
  const result = await runPaymentReconciliationSweep(database, {
    NANGO_API_KEY: "configured",
    fetch: async (input) => {
      const url = String(input);
      pages.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      return Response.json(page === 1 ? {
        page: 1,
        total_pages: 2,
        transaction_details: [{ transaction_info: {
          transaction_id: "paypal-txn-1", paypal_reference_id: "pi_1", invoice_id: "attempt-1",
          transaction_amount: { value: "500.00", currency_code: "PHP" }, fee_amount: { value: "-15.00", currency_code: "PHP" },
          transaction_status: "S", transaction_initiation_date: "2026-09-01T12:00:00Z",
        } }],
      } : { page: 2, total_pages: 2, transaction_details: [] });
    },
  });
  assert.equal(pages.length, 2);
  assert.equal(new URL(pages[1]!).searchParams.get("page"), "2");
  assert.equal(result.result?.provider_rows_complete, true);
  assert.equal(result.result?.status, "matched");
});

test("PayPal pending transactions never match a paid local attempt", async () => {
  const { database, statements } = fixture({ provider: "paypal" });
  await runPaymentReconciliationSweep(database, {
    NANGO_API_KEY: "configured",
    fetch: async () => Response.json({ page: 1, total_pages: 1, transaction_details: [{ transaction_info: {
      transaction_id: "paypal-txn-1", paypal_reference_id: "pi_1", invoice_id: "attempt-1",
      transaction_amount: { value: "500.00", currency_code: "PHP" }, transaction_status: "P",
    } }] }),
  });
  const persisted = statements.find(({ sql }) => sql.includes("INSERT INTO public.payment_settlement_records"));
  assert.ok(persisted);
  assert.equal(persisted.values[10], "needs_review");
  assert.equal(persisted.values[13], "provider_not_settled");
});

test("normalizes a successful Xendit transaction into a matched settlement", async () => {
  const { database, statements } = fixture({ provider: "xendit" });
  let requestUrl = "";
  const result = await runPaymentReconciliationSweep(database, {
    NANGO_API_KEY: "configured",
    fetch: async (input) => {
      requestUrl = String(input);
      return Response.json({ data: [{
        id: "xnd-transaction-1", type: "PAYMENT", status: "SUCCESS", reference_id: "attempt-1",
        payment_request_id: "pi_1", amount: 500, currency: "PHP", fee: { xendit_fee: 15 },
        net_amount: 485, net_amount_currency: "PHP", created: "2026-09-01T12:00:00Z",
      }], has_more: false });
    },
  });
  assert.match(requestUrl, /^https:\/\/api\.nango\.dev\/proxy\/transactions\?/);
  assert.equal(result.result?.status, "matched");
  const persisted = statements.find(({ sql }) => sql.includes("INSERT INTO public.payment_settlement_records"));
  assert.ok(persisted);
  assert.equal(persisted.values[6], 50000);
  assert.equal(persisted.values[7], 1500);
  assert.equal(persisted.values[8], 48500);
  assert.equal(persisted.values[10], "matched");
});

test("refuses to combine multiple active merchant connections", async () => {
  const { database, statements } = fixture({ connectionCount: 2 });
  let called = false;
  const result = await runPaymentReconciliationSweep(database, { NANGO_API_KEY: "configured", fetch: async () => { called = true; return Response.json(chargeReport); } });
  assert.equal(called, false);
  assert.deepEqual(result, { processed: 1, failed: true });
  assert.ok(statements.some(({ sql, values }) => sql.includes("UPDATE public.payment_provider_artifacts") && values.includes("provider_connection_ambiguous")));
});

test("does not match a provider payment when the local attempt is not settled", async () => {
  const { database, statements } = fixture({ attemptStatus: "failed" });
  await runPaymentReconciliationSweep(database, { NANGO_API_KEY: "configured", fetch: async () => Response.json(chargeReport) });
  const persisted = statements.find(({ sql }) => sql.includes("INSERT INTO public.payment_settlement_records"));
  assert.ok(persisted);
  assert.equal(persisted.values[10], "needs_review");
  assert.equal(persisted.values[13], "local_attempt_not_settled");
});

test("fails malformed jobs closed without making provider requests", async () => {
  const { database, statements } = fixture({ payload: { organizationId: "org-1", provider: "card", idempotencyKey: "key" } });
  let called = false;
  const result = await runPaymentReconciliationSweep(database, { fetch: async () => { called = true; return Response.json({}); } });
  assert.deepEqual(result, { processed: 1, failed: true });
  assert.equal(called, false);
  assert.ok(statements.some(({ sql }) => sql.includes("SET status='failed'") && sql.includes("Invalid reconciliation payload")));
});
