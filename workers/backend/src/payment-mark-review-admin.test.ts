import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminPaymentMarkReviewRequest } from "./payment-mark-review-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

function request(headers: Record<string, string> = {}) {
  return new Request("https://api.test/api/admin/payments/attempt_1/mark-review", {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "review-1", ...headers },
  });
}

test("payment mark-review rejects unauthenticated and non-idempotent writes", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const unauthenticated = await handleAdminPaymentMarkReviewRequest(new Request("https://api.test/api/admin/payments/attempt_1/mark-review", { method: "POST" }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_1");
  assert.equal(unauthenticated.status, 401);
  const missingKey = await handleAdminPaymentMarkReviewRequest(request({ "Idempotency-Key": "" }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_2");
  assert.equal(missingKey.status, 400);
});

test("payment mark-review scopes the attempt, updates state, and audits the mutation", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.includes("SELECT id, last_error")) return { rows: [{ id: "attempt_1", last_error: "provider timeout" }], rowCount: 1 } as { rows: T[]; rowCount: number };
      if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }], rowCount: 1 } as { rows: T[]; rowCount: number };
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    },
    async end() {},
  };
  const response = await handleAdminPaymentMarkReviewRequest(request(), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_3");
  assert.equal(response.status, 200);
  assert.ok(queries.some((query) => query.includes("organization_id=$1") && query.includes("correlation_id=$2")));
  assert.ok(queries.some((query) => query.includes("status='needs_review'") && query.includes("organization_id=$2")));
  assert.ok(queries.some((query) => query.includes("INSERT INTO public.audit_logs")));
});

test("payment mark-review returns not-found without writing or auditing", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      if (text.includes("SELECT id, last_error")) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }], rowCount: 1 } as { rows: T[]; rowCount: number };
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    },
    async end() {},
  };
  const response = await handleAdminPaymentMarkReviewRequest(request({ "Idempotency-Key": "review-2" }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_4");
  assert.equal(response.status, 404);
  assert.equal(queries.some((query) => query.includes("UPDATE public.payment_attempts")), false);
  assert.equal(queries.some((query) => query.includes("INSERT INTO public.audit_logs")), false);
});
