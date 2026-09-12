import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminRefundRequest } from "./admin-refund.ts";

function adminToken(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "staff_1",
    email: "admin@example.com",
    role: "admin",
    permissions: ["orders:write"],
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signature = createHmac("sha256", "admin-secret")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function fixture() {
  const queries: Array<{ role: string; text: string; values: readonly unknown[] }> = [];
  const env = {
    CMS_ADMIN_JWT_SECRET: "admin-secret",
    STRIPE_API_KEY: "sk_test_key",
    providerFetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      assert.equal(request.url, "https://api.stripe.com/v1/refunds");
      assert.equal(request.headers.get("Idempotency-Key"), "refund-1");
      return new Response(JSON.stringify({ id: "re_test", status: "succeeded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    databaseFactory(role: "app" | "medusa"): WorkerDatabaseClient {
      return {
        async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
          queries.push({ role, text, values });
          if (role === "app" && text.includes("INSERT INTO public.worker_idempotency_records")) {
            return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("INSERT INTO public.payment_refund_audit")) {
            return { rows: [], rowCount: 1 };
          }
          if (role === "app" && text.includes("UPDATE public.worker_idempotency_records")) {
            return { rows: [], rowCount: 1 };
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
  assert.equal(paymentQuery.text.includes("p.captured_amount"), false);
  assert.ok(state.queries.some((query) => query.role === "app" && query.text.includes("payment_refund_audit")));
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
