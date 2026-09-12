import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleInvoiceCreateRequest, handleInvoiceLifecycleRequest, handleInvoiceListRequest } from "./invoice-admin.ts";

function token(permission: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff-1", role: "admin", permissions: [permission], organization_id: "org-1", exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", "secret").update(`${header}.${payload}`).digest("base64url")}`;
}

function database(): { client: WorkerDatabaseClient; queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    client: {
      async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
        queries.push(text);
        if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
        if (text.includes("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
        if (text.includes("SELECT id,status,fiscal_status,document_kind")) return { rows: [{ id: "11111111-1111-4111-8111-111111111111", status: "failed", fiscal_status: "non_fiscal", document_kind: "receipt" }] as T[], rowCount: 1 };
        if (text.includes("record_invoice_lifecycle")) return { rows: [{ record_invoice_lifecycle: { id: "11111111-1111-4111-8111-111111111111", status: "retryable" } }] as T[], rowCount: 1 };
        if (text.includes("FROM public.admin_invoices")) return { rows: [{ id: "11111111-1111-4111-8111-111111111111", organization_id: "org-1", status: "draft" }] as T[], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
      async end() {},
    },
  };
}

test("invoice list requires the receipts read permission and tenant filter", async () => {
  const state = database();
  const response = await handleInvoiceListRequest(new Request("https://api.example/admin/invoices", { headers: { Authorization: `Bearer ${token("receipts:read")}` } }), state.client, { CMS_ADMIN_JWT_SECRET: "secret" });
  assert.equal(response.status, 200);
  assert.match(state.queries[0] ?? "", /organization_id = \$1/);
});

test("invoice lifecycle delegates transition and idempotency to the canonical database RPC", async () => {
  const state = database();
  const response = await handleInvoiceLifecycleRequest(new Request("https://api.example/admin/invoices/11111111-1111-4111-8111-111111111111/lifecycle", {
    method: "POST",
    headers: { Authorization: `Bearer ${token("receipts:send")}`, "Content-Type": "application/json", "Idempotency-Key": "invoice-retry-1" },
    body: JSON.stringify({ action: "retry" }),
  }), state.client, { CMS_ADMIN_JWT_SECRET: "secret" }, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { id: "11111111-1111-4111-8111-111111111111", status: "retryable" } });
  const rpc = state.queries.find((query) => query.includes("record_invoice_lifecycle"));
  assert.ok(rpc);
  assert.match(rpc!, /\$3, \$4, \$5, \$6/);
});

test("invoice lifecycle rejects a malformed identifier before touching the database", async () => {
  const state = database();
  const response = await handleInvoiceLifecycleRequest(new Request("https://api.example/admin/invoices/not-an-id/lifecycle", { method: "POST", headers: { Authorization: `Bearer ${token("receipts:send")}`, "Idempotency-Key": "invoice-1" }, body: JSON.stringify({ action: "void" }) }), state.client, { CMS_ADMIN_JWT_SECRET: "secret" }, "not-an-id");
  assert.equal(response.status, 400);
  assert.equal(state.queries.length, 0);
});

test("invoice creation canonicalizes the Medusa recipient and persists a tenant-scoped draft", async () => {
  const appQueries: string[] = [];
  const app: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      appQueries.push(text);
      if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }] as T[], rowCount: 1 };
      if (text.includes("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
      if (text.includes("INSERT INTO public.admin_invoices")) return { rows: [{ id: "11111111-1111-4111-8111-111111111111", reference_number: "INV-1", status: "draft" }] as T[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  const medusa: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string) {
      assert.match(text, /FROM public\.customer/);
      return { rows: [{ id: "cus-1", email: "buyer@example.com", first_name: "Buyer", last_name: "One" }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  const response = await handleInvoiceCreateRequest(new Request("https://api.example/admin/invoices", {
    method: "POST",
    headers: { Authorization: `Bearer ${token("receipts:send")}`, "Content-Type": "application/json", "Idempotency-Key": "invoice-create-1" },
    body: JSON.stringify({ invoice: { referenceNumber: "INV-1", to: { id: "cus-1", email: "buyer@example.com" }, items: [{ description: "Guitar", quantity: 1, unitPrice: 5997 }] }, mode: "draft" }),
  }), app, medusa, { CMS_ADMIN_JWT_SECRET: "secret" });
  assert.equal(response.status, 201);
  assert.ok(appQueries.some((query) => query.includes("organization_id")));
  assert.ok(appQueries.some((query) => query.includes("record_invoice_lifecycle")));
});

test("invoice creation rejects invalid fiscal boundaries before database access", async () => {
  let calls = 0;
  const database: WorkerDatabaseClient = { async query() { calls += 1; return { rows: [], rowCount: 0 }; }, async end() {} };
  const response = await handleInvoiceCreateRequest(new Request("https://api.example/admin/invoices", {
    method: "POST",
    headers: { Authorization: `Bearer ${token("receipts:send")}`, "Idempotency-Key": "invoice-create-2" },
    body: JSON.stringify({ invoice: { referenceNumber: "INV-2", to: { id: "cus-1", email: "buyer@example.com" }, items: [{ description: "Guitar", quantity: 1, unitPrice: 1 }] }, documentKind: "fiscal_invoice" }),
  }), database, database, { CMS_ADMIN_JWT_SECRET: "secret" });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});
