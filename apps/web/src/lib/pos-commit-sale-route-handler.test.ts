import assert from "node:assert/strict";
import test from "node:test";

import { correlatedError } from "./staff-api-response";
import { handlePosCommitSaleRequest } from "./pos-commit-sale-route-handler";

test("handlePosCommitSaleRequest tags unauthorized responses", async () => {
  const req = new Request("http://localhost/api/pos/medusa/commit-sale", {
    method: "POST",
  });

  const unauthorized = correlatedError("staff_req", 401, "No session", "UNAUTHORIZED");
  const res = await handlePosCommitSaleRequest(req, {
    getCorrelationId: () => "staff_req",
    requireStaffApiSession: async () => ({ ok: false, response: unauthorized }),
    logAdminApiEvent: () => {},
    getIdempotencyKey: () => undefined,
    getCompletedReplayOrderNumber: () => undefined,
    isInflight: () => false,
    startInflight: () => {},
    clearInflight: () => {},
    executeCommitSale: async () => {
      throw new Error("should not execute");
    },
  });

  assert.equal(res.status, 401);
  assert.equal(res.headers.get("x-request-id"), "staff_req");
});

test("handlePosCommitSaleRequest returns replayed idempotent order before mutation", async () => {
  const req = new Request("http://localhost/api/pos/medusa/commit-sale", {
    method: "POST",
    headers: { "idempotency-key": "idem_1" },
  });

  const res = await handlePosCommitSaleRequest(req, {
    getCorrelationId: () => "staff_req",
    requireStaffApiSession: async () => ({ ok: true }),
    logAdminApiEvent: () => {},
    getIdempotencyKey: (request) => request.headers.get("idempotency-key") ?? undefined,
    getCompletedReplayOrderNumber: () => "1001",
    isInflight: () => false,
    startInflight: () => {},
    clearInflight: () => {},
    executeCommitSale: async () => {
      throw new Error("should not execute");
    },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { orderNumber: "1001", idempotent: true });
});

test("handlePosCommitSaleRequest rejects duplicate in-flight idempotency keys", async () => {
  const req = new Request("http://localhost/api/pos/medusa/commit-sale", {
    method: "POST",
    headers: { "idempotency-key": "idem_1" },
  });

  const res = await handlePosCommitSaleRequest(req, {
    getCorrelationId: () => "staff_req",
    requireStaffApiSession: async () => ({ ok: true }),
    logAdminApiEvent: () => {},
    getIdempotencyKey: (request) => request.headers.get("idempotency-key") ?? undefined,
    getCompletedReplayOrderNumber: () => undefined,
    isInflight: () => true,
    startInflight: () => {},
    clearInflight: () => {},
    executeCommitSale: async () => {
      throw new Error("should not execute");
    },
  });

  assert.equal(res.status, 409);
  const body = (await res.json()) as { code: string };
  assert.equal(body.code, "CONFLICT");
});

test("handlePosCommitSaleRequest returns committed sale payload", async () => {
  const inflight: string[] = [];
  const req = new Request("http://localhost/api/pos/medusa/commit-sale", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "idempotency-key": "idem_1",
    },
    body: JSON.stringify({
      items: [{ variantId: "variant_1", quantity: 1 }],
      offlineSaleId: "offline_1",
    }),
  });

  const res = await handlePosCommitSaleRequest(req, {
    getCorrelationId: () => "staff_req",
    requireStaffApiSession: async () => ({ ok: true }),
    logAdminApiEvent: () => {},
    getIdempotencyKey: (request) => request.headers.get("idempotency-key") ?? undefined,
    getCompletedReplayOrderNumber: () => undefined,
    isInflight: (key) => inflight.includes(key),
    startInflight: (key) => inflight.push(key),
    clearInflight: (key) => {
      const index = inflight.indexOf(key);
      if (index >= 0) inflight.splice(index, 1);
    },
    executeCommitSale: async ({ idempotencyKey }) => ({
      status: 200,
      body: { orderNumber: "1001", orderId: "order_1", idempotent: Boolean(idempotencyKey) },
      logPhase: "ok",
      logDetail: { orderNumber: "1001" },
    }),
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    orderNumber: "1001",
    orderId: "order_1",
    idempotent: true,
  });
  assert.equal(inflight.length, 0);
});
