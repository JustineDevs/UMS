import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminOrderStatusRequest } from "./admin-order-status.ts";

function b64(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function bearer(): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff_1", role: "staff", permissions: ["orders:write"], organization_id: "org_1", exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("order-status-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

function clients(appOptions: { ledgerFails?: boolean } = {}) {
  const appCalls: string[] = [];
  const commerceCalls: string[] = [];
  const app: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string) {
      appCalls.push(sql);
      if (sql.includes("append_canonical_order_state") && appOptions.ledgerFails) throw new Error("ledger_down");
      return { rows: sql.startsWith("INSERT INTO public.worker_idempotency_records") ? [{ state: "pending" } as T] : [], rowCount: 1 };
    },
    async end() {},
  };
  const commerce: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string) {
      commerceCalls.push(sql);
      if (sql.startsWith("SELECT id, COALESCE(metadata")) return { rows: [{ id: "order_1", metadata: { organization_id: "org_1", oms_status: "paid" } } as T], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  return { app, commerce, appCalls, commerceCalls };
}

function request(authorization: string | null, status = "processing"): Request {
  return new Request("https://worker.test/api/admin/orders/order_1/status", {
    method: "PATCH",
    headers: {
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      "Idempotency-Key": "status-transition-1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

test("order status rejects unauthenticated requests before touching either database", async () => {
  const db = clients();
  const response = await handleAdminOrderStatusRequest(request(null), db.commerce, db.app, { JWT_SECRET: "order-status-secret" }, "order_1");
  assert.equal(response.status, 403);
  assert.equal(db.commerceCalls.length, 0);
  assert.equal(db.appCalls.length, 0);
});

test("order status updates the tenant-owned commerce projection and canonical APP ledger", async () => {
  const db = clients();
  const response = await handleAdminOrderStatusRequest(request(await bearer()), db.commerce, db.app, { JWT_SECRET: "order-status-secret" }, "order_1");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "processing" });
  assert.ok(db.commerceCalls.some((sql) => sql.includes("COALESCE(metadata->>'organization_id', metadata->>'store_id') = $2")));
  assert.ok(db.appCalls.some((sql) => sql.includes("append_canonical_order_state")));
  assert.ok(db.appCalls.some((sql) => sql.includes("worker_idempotency_records")));
});

test("order status restores the prior commerce projection when APP ledger recording fails", async () => {
  const db = clients({ ledgerFails: true });
  const response = await handleAdminOrderStatusRequest(request(await bearer()), db.commerce, db.app, { JWT_SECRET: "order-status-secret" }, "order_1");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "canonical_order_state_unavailable" });
  assert.ok(db.commerceCalls.some((sql) => sql.includes("SET metadata = $3::jsonb")));
});

test("order status rejects unsupported or legacy-only states", async () => {
  const db = clients();
  const response = await handleAdminOrderStatusRequest(request(await bearer(), "ready_to_ship"), db.commerce, db.app, { JWT_SECRET: "order-status-secret" }, "order_1");
  assert.equal(response.status, 400);
  assert.equal(db.commerceCalls.length, 0);
});
