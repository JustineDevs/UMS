import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminRefundRequest, type AdminRefundEnv } from "./admin-refund.ts";

function adminToken(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "staff_1",
    email: "admin@example.com",
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signature = createHmac("sha256", "admin-secret")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function fixture(options: { orderOwned?: boolean; staffRole?: "admin" | "staff"; providerStatus?: string; providerFailure?: string; earlyRefundEvent?: boolean; priorRefundedMinor?: number } = {}) {
  const queries: Array<{ role: string; text: string; values: readonly unknown[] }> = [];
  const env: AdminRefundEnv & { databaseFactory: NonNullable<AdminRefundEnv["databaseFactory"]> } = {
    CMS_ADMIN_JWT_SECRET: "admin-secret",
    STRIPE_API_KEY: "sk_test_key",
    providerFetch: async (input: Request | URL | string, init?: RequestInit) => {
      const request = new Request(input, init);
      queries.push({ role: "provider", text: request.url, values: [] });
      assert.equal(request.url, "https://api.stripe.com/v1/refunds");
      assert.match(request.headers.get("Idempotency-Key") ?? "", /^[a-f0-9]{64}$/);
      if (options.providerFailure) throw new Error(options.providerFailure);
      return new Response(JSON.stringify({ id: "re_test", status: options.providerStatus ?? "succeeded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    databaseFactory(role: "app" | "medusa"): WorkerDatabaseClient {
      return {
        async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
          queries.push({ role, text, values });
          if (role === "app" && text.includes("FROM public.users")) {
            return { rows: [{ id: "00000000-0000-4000-8000-000000000001" }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("FROM public.organization_memberships")) {
            return { rows: [{ organization_id: "org_1", role: "admin" }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("FROM public.user_roles")) {
            return { rows: [{ role: options.staffRole ?? "admin" }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("INSERT INTO public.worker_idempotency_records")) {
            return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("FROM public.payment_refund_audit") && text.includes("FOR UPDATE")) {
            return { rows: [] as T[], rowCount: 0 };
          }
          if (role === "app" && text.includes("FROM public.payment_refund_audit")) {
            return { rows: [{ completed_minor: 0, reserved_minor: options.priorRefundedMinor ?? 0 }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("INSERT INTO public.payment_refund_audit")) {
            return { rows: [{ amount_minor: values[3], medusa_payment_id: values[1], provider: values[2], provider_refund_id: null, provider_status: null, status: "requested" }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.startsWith("UPDATE public.payment_refund_audit")) {
            return { rows: [], rowCount: 1 };
          }
          if (role === "app" && text.includes("UPDATE public.worker_idempotency_records")) {
            return { rows: [], rowCount: 1 };
          }
          if (role === "medusa" && text.includes('FROM public."order"')) {
            return options.orderOwned === false
              ? { rows: [] as T[], rowCount: 0 }
              : { rows: [{ id: "order_1" }] as T[], rowCount: 1 };
          }
          if (role === "medusa" && text.includes("FROM public.payment p")) {
            return {
              rows: [{
                id: "pay_1",
                order_id: "order_1",
                amount: 1200,
                currency_code: "PHP",
                provider_id: "pp_stripe_stripe",
                data: { payment_intent: "pi_test", captured_amount_minor: 1200, refunded_amount_minor: 0 },
              }] as T[],
              rowCount: 1,
            };
          }
          if (role === "medusa" && text.includes("FROM public.payment_webhook_events")) {
            return options.earlyRefundEvent
              ? { rows: [{ event_type: "refund.updated", payload: { data: { object: { id: "re_test", status: "succeeded" } } } }] as T[], rowCount: 1 }
              : { rows: [] as T[], rowCount: 0 };
          }
          if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 0 };
        },
        async end() {},
      };
    },
  };
  return { env, queries };
}

test("admin refund requires authenticated staff authorization", async () => {
  const state = fixture();
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", { method: "POST" }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 401);
  assert.equal(state.queries.length, 0);
});

test("admin refund uses payment data state, provider idempotency, and APP audit", async () => {
  const state = fixture();
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-1",
        "X-Request-ID": "req-1",
      },
      body: JSON.stringify({ amount_minor: 1200, note: "customer request" }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    payment_id: "pay_1",
    provider: "stripe",
    refund_id: "re_test",
    provider_status: "succeeded",
    amount_minor: 1200,
  });
  const paymentQuery = state.queries.find((query) => query.text.includes("FROM public.payment p"));
  assert.ok(paymentQuery);
  assert.match(paymentQuery.text, /o\.metadata->>'organization_id' = \$3/);
  assert.equal(paymentQuery.text.includes("p.captured_amount"), false);
  const audit = state.queries.find((query) => query.role === "app" && query.text.includes("INSERT INTO public.payment_refund_audit"));
  assert.ok(audit);
  assert.match(audit.text, /organization_id/);
  assert.equal(audit.values[4], "admin@example.com");
  assert.match(audit.text, /request_idempotency_key/);
  assert.equal(audit.values[2], "stripe");
  assert.equal(audit.values[3], 1200);
  assert.equal(audit.values[6], state.queries.find((query) => query.text.includes("INSERT INTO public.worker_idempotency_records"))?.values[0]);
  const reservedBalanceQuery = state.queries.find((query) => query.text.includes("SUM(amount_minor)"));
  assert.match(reservedBalanceQuery?.text ?? "", /SUM\(amount_minor\) FILTER \(WHERE status IN \('requested', 'pending', 'processing'\)\)/);
  const lock = state.queries.findIndex((query) => query.text.includes("pg_advisory_xact_lock"));
  const reservation = state.queries.findIndex((query) => query.text.includes("INSERT INTO public.payment_refund_audit"));
  const providerCall = state.queries.findIndex((query) => query.role === "provider");
  assert.ok(lock >= 0 && lock < reservation);
  assert.ok(reservation < providerCall);
  assert.ok(state.queries.some((query) => query.text === "BEGIN"));
  assert.ok(state.queries.some((query) => query.text === "COMMIT"));
  const claim = state.queries.find((query) => query.role === "app" && query.text.includes("INSERT INTO public.worker_idempotency_records"));
  assert.ok(claim);
  assert.match(String(claim.values[0]), /^[a-f0-9]{64}$/);
  assert.notEqual(claim.values[0], "refund-1");
});

test("admin refund finds Xendit payment request identity in native session payload", async () => {
  const state = fixture();
  const originalFactory = state.env.databaseFactory;
  state.env.XENDIT_SECRET_KEY = "xnd_test_key";
  state.env.providerFetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(request.url, "https://api.xendit.co/refunds");
    const body = await request.json() as { payment_request_id?: string; reference_id?: string; reason?: string };
    assert.equal(body.payment_request_id, "pr_test");
    assert.equal(body.reference_id, "order_1");
    assert.equal(body.reason, "REQUESTED_BY_CUSTOMER");
    return new Response(JSON.stringify({ refund_id: "refund_xendit", status: "SUCCEEDED" }), { status: 200 });
  };
  state.env.databaseFactory = (role) => {
    const database = originalFactory(role);
    const query = database.query.bind(database);
    database.query = async (text, values) => {
      if (role === "medusa" && text.includes("FROM public.payment p")) {
        return { rows: [{ id: "pay_xendit", order_id: "order_1", amount: 1200, currency_code: "PHP", provider_id: "pp_xendit_xendit", data: { providerPayload: { xenditSession: { payment_request_id: "pr_test" } }, captured_amount_minor: 1200 } }] as never[], rowCount: 1 };
      }
      return query(text, values);
    };
    return database;
  };
  const response = await handleAdminRefundRequest(new Request("https://api.example.com/api/admin/orders/order_1/refund", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken()}`, "Content-Type": "application/json", "Idempotency-Key": "refund-xendit-1" },
    body: JSON.stringify({ amount_minor: 1200 }),
  }), state.env, "order_1");
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { provider: string }).provider, "xendit");
});

test("admin refund persists Stripe pending status without claiming completion", async () => {
  const state = fixture({ providerStatus: "pending" });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-pending",
      },
      body: JSON.stringify({ amount_minor: 500 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 202);
  assert.equal((await response.json() as { provider_status: string }).provider_status, "pending");
  const audit = state.queries.find((query) => query.text.includes("INSERT INTO public.payment_refund_audit"));
  assert.equal(audit?.values[3], 500);
  const update = state.queries.find((query) => query.text.startsWith("UPDATE public.payment_refund_audit") && query.text.includes("provider_refund_id"));
  assert.equal(update?.values[5], "pending");
});

test("admin refund stores provider-reported failure and does not report a successful refund", async () => {
  const state = fixture({ providerStatus: "failed" });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-failed",
      },
      body: JSON.stringify({ amount_minor: 500 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json() as { error: string }).error, "provider_refund_failed");
  const update = state.queries.find((query) => query.text.startsWith("UPDATE public.payment_refund_audit") && query.text.includes("provider_refund_id"));
  assert.equal(update?.values[5], "failed");
});

test("admin refund reconciles a provider callback that arrived before its audit insert", async () => {
  const state = fixture({ providerStatus: "pending", earlyRefundEvent: true });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-race",
      },
      body: JSON.stringify({ amount_minor: 500 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { provider_status: string }).provider_status, "succeeded");
  const reconciliation = state.queries.find((query) => query.role === "app" && query.text.startsWith("UPDATE public.payment_refund_audit") && query.text.includes("SET status = $3"));
  assert.deepEqual(reconciliation?.values?.slice(2, 5), ["completed", "succeeded", null]);
});

test("refund reservation atomically prevents distinct requests exceeding captured balance", async () => {
  const state = fixture({ priorRefundedMinor: 900 });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-over-reserved",
      },
      body: JSON.stringify({ amount_minor: 400 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "amount_exceeds_refundable_balance", refundable_minor: 300 });
  assert.equal(state.queries.some((query) => query.role === "provider"), false);
  assert.equal(state.queries.some((query) => query.text.includes("INSERT INTO public.payment_refund_audit")), false);
});

test("uncertain provider failure keeps its balance reservation retryable", async () => {
  const state = fixture({ providerFailure: "stripe_refund_request_failed:500" });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-unknown-provider-outcome",
      },
      body: JSON.stringify({ amount_minor: 500 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "provider_refund_outcome_unknown" });
  assert.ok(state.queries.some((query) => query.text.includes("INSERT INTO public.payment_refund_audit")));
  assert.ok(state.queries.some((query) => query.text.includes("DELETE FROM public.worker_idempotency_records")));
  assert.equal(state.queries.some((query) => query.text.includes("SET status = 'failed'")), false);
});

test("definitive provider rejection releases the reserved refundable balance", async () => {
  const state = fixture({ providerFailure: "stripe_refund_request_failed:400" });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-provider-rejected",
      },
      body: JSON.stringify({ amount_minor: 500 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "provider_refund_rejected" });
  assert.ok(state.queries.some((query) => query.text.includes("SET status = 'failed'")));
});

test("admin refund enforces Worker step-up independently of the Next proxy", async () => {
  const state = fixture();
  state.env.ADMIN_STEP_UP_REQUIRED = "true";
  state.env.ADMIN_STEP_UP_SECRET = "step-up-secret";
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-step-up",
      },
      body: JSON.stringify({ amount_minor: 1200 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 403);
  assert.equal(state.queries.some((query) => query.text.includes("INSERT INTO public.worker_idempotency_records")), false);
});

test("admin refund accepts a valid Worker-verified step-up assertion", async () => {
  const state = fixture();
  state.env.ADMIN_STEP_UP_REQUIRED = "true";
  state.env.ADMIN_STEP_UP_SECRET = "step-up-secret";
  const expires = Math.floor(Date.now() / 1000) + 60;
  const signature = createHmac("sha256", "step-up-secret").update(`orders.refund.${expires}`).digest("hex");
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-step-up-valid",
        "x-admin-step-up": `orders.refund.${expires}.${signature}`,
      },
      body: JSON.stringify({ amount_minor: 1200 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 200);
});

test("admin refund does not look up payment or invoke provider for another tenant order", async () => {
  const state = fixture({ orderOwned: false });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-other-tenant",
      },
      body: JSON.stringify({ amount_minor: 1200 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 404);
  assert.equal(state.queries.some((query) => query.role === "medusa" && query.text.includes("FROM public.payment p")), false);
  assert.equal(state.queries.some((query) => query.role === "app" && query.text.includes("FROM public.payment_refund_audit")), false);
});

test("admin refund checks current APP permission grants instead of JWT role claims", async () => {
  const state = fixture({ staffRole: "staff" });
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "refund-no-permission",
      },
      body: JSON.stringify({ amount_minor: 1200 }),
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 403);
  assert.equal(state.queries.some((query) => query.role === "medusa"), false);
});

test("admin refund rejects missing idempotency before database access", async () => {
  const state = fixture();
  const response = await handleAdminRefundRequest(
    new Request("https://api.example.com/api/admin/orders/order_1/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken()}` },
    }),
    state.env,
    "order_1",
  );
  assert.equal(response.status, 400);
  assert.equal(state.queries.length, 0);
});
