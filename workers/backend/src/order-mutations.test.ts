import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import {
  handleOrderCancellationRequest,
  handleOrderReturnRequest,
} from "./order-mutations.ts";

function token(email = "buyer@example.com"): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "cus_1", email, exp: Math.floor(Date.now() / 1000) + 300 });
  const signature = createHmac("sha256", "test-secret")
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function fixture(orderStatus = "completed") {
  const queries: Array<{ role: string; text: string; values: readonly unknown[] }> = [];
  const env = {
    JWT_SECRET: "test-secret",
    databaseFactory(role: "app" | "medusa"): WorkerDatabaseClient {
      return {
        async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
          queries.push({ role, text, values });
          if (role === "app" && text.startsWith("INSERT INTO public.worker_idempotency_records")) {
            return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.startsWith("UPDATE public.worker_idempotency_records")) {
            return { rows: [], rowCount: 1 };
          }
          if (role === "medusa" && text.startsWith("UPDATE public.\"order\"")) {
            return { rows: [{ id: "order_1", customer_id: "cus_1", email: "buyer@example.com", status: "canceled" }] as T[], rowCount: 1 };
          }
          if (role === "medusa" && text.includes('FROM public."order"')) {
            return { rows: [{ id: "order_1", customer_id: "cus_1", email: "buyer@example.com", status: orderStatus }] as T[], rowCount: 1 };
          }
          if (role === "medusa" && text.includes("FROM public.order_item")) {
            return { rows: [{ id: "oit_1", quantity: 2, return_requested_quantity: 0, return_received_quantity: 0, return_dismissed_quantity: 0, written_off_quantity: 0 }] as T[], rowCount: 1 };
          }
          if (role === "app" && text.includes("INSERT INTO public.background_jobs")) return { rows: [{ id: "job_1" }] as T[], rowCount: 1 };
          if (role === "app" && text.includes("INSERT INTO public.customer_return_request_audit")) return { rows: [{ id: "audit_1" }] as T[], rowCount: 1 };
          if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [], rowCount: 0 };
          if (text.includes("UPDATE public.order_item")) return { rows: [], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        },
        async end() {},
      };
    },
  };
  return { env, queries };
}

test("order cancellation requires authenticated ownership", async () => {
  const fixtureState = fixture();
  const response = await handleOrderCancellationRequest(
    new Request("https://api.example.com/store/customers/me/orders/order_1/cancel", { method: "POST" }),
    fixtureState.env,
    "order_1",
  );
  assert.equal(response.status, 401);
  assert.equal(fixtureState.queries.length, 0);
});

test("order cancellation updates only an owned cancellable order", async () => {
  const fixtureState = fixture("pending");
  const response = await handleOrderCancellationRequest(
    new Request("https://api.example.com/store/customers/me/orders/order_1/cancel", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "cancel-1" },
    }),
    fixtureState.env,
    "order_1",
  );
  assert.equal(response.status, 200);
  assert.ok(fixtureState.queries.some((query) => query.text.includes("UPDATE public.\"order\"")));
});

test("return request validates remaining quantity and records APP review work", async () => {
  const fixtureState = fixture();
  const response = await handleOrderReturnRequest(
    new Request("https://api.example.com/store/orders/return", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", "Idempotency-Key": "return-1" },
      body: JSON.stringify({ orderId: "order_1", items: [{ item_id: "oit_1", quantity: 1 }] }),
    }),
    fixtureState.env,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).auditStatus, "recorded");
  assert.ok(fixtureState.queries.some((query) => query.role === "medusa" && query.text.includes("return_requested_quantity")));
  assert.ok(fixtureState.queries.some((query) => query.role === "app" && query.text.includes("customer_return_request_audit")));
});

test("return request rejects duplicate lines before touching either database", async () => {
  const fixtureState = fixture();
  const response = await handleOrderReturnRequest(
    new Request("https://api.example.com/store/orders/return", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order_1", items: [{ item_id: "oit_1", quantity: 1 }, { item_id: "oit_1", quantity: 1 }] }),
    }),
    fixtureState.env,
  );
  assert.equal(response.status, 400);
  assert.equal(fixtureState.queries.length, 0);
});
