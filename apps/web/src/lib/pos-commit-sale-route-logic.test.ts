import assert from "node:assert/strict";
import test from "node:test";

import {
  posCommitSaleRouteLogic,
  type PosCommitSaleRouteResult,
} from "./pos-commit-sale-route-logic";

function expectOk(result: PosCommitSaleRouteResult): Extract<PosCommitSaleRouteResult, { logPhase: "ok" }> {
  assert.equal(result.logPhase, "ok");
  return result;
}

function expectError(
  result: PosCommitSaleRouteResult,
): Extract<PosCommitSaleRouteResult, { logPhase: "error" }> {
  assert.equal(result.logPhase, "error");
  return result;
}

test("posCommitSaleRouteLogic replays completed idempotent sales", async () => {
  const result = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 1 }] },
    correlationId: "req_1",
    idempotencyKey: "idem_1",
    envReady: true,
    completedReplayOrderNumber: "1001",
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });

  const ok = expectOk(result);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.orderNumber, "1001");
  assert.equal(ok.body.idempotent, true);
});

test("posCommitSaleRouteLogic rejects missing items", async () => {
  const result = await posCommitSaleRouteLogic({
    body: { items: [] },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });

  const error = expectError(result);
  assert.equal(error.status, 400);
  assert.equal(error.body.code, "BAD_REQUEST");
});

test("posCommitSaleRouteLogic rejects an uncertified payment terminal", async () => {
  const result = await posCommitSaleRouteLogic({
    body: {
      items: [{ variantId: "variant_1", quantity: 1 }],
      paymentTerminalId: "terminal_1",
    },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    assertTerminalReady: async () => false,
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001" }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });
  const error = expectError(result);
  assert.equal(error.status, 409);
  assert.equal(error.body.code, "POS_POLICY_DENIED");
});

test("posCommitSaleRouteLogic requires a terminal or provider reference for non-cash sales", async () => {
  const result = await posCommitSaleRouteLogic({
    body: {
      items: [{ variantId: "variant_1", quantity: 1 }],
      paymentMethod: "card",
    },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001" }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });

  const error = expectError(result);
  assert.equal(error.status, 409);
  assert.equal(error.body.code, "POS_POLICY_DENIED");
});

test("posCommitSaleRouteLogic enforces stock and policy denials", async () => {
  const stockDenied = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 2 }] },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({
      ok: false,
      message: "Insufficient stock",
      code: "INSUFFICIENT_STOCK",
    }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });
  assert.equal(expectError(stockDenied).status, 409);

  const policyDenied = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 2 }], shiftId: "shift_1" },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "closed",
    evaluatePolicy: () => ({ allowed: false, violations: ["Shift must be open"] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });
  const denied = expectError(policyDenied);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, "POS_POLICY_DENIED");
});

test("posCommitSaleRouteLogic returns existing order for offline replay", async () => {
  const result = await posCommitSaleRouteLogic({
    body: {
      items: [{ variantId: "variant_1", quantity: 1 }],
      offlineSaleId: "offline_1",
    },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => ({
      id: "order_1",
      displayId: "1001",
    }),
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });

  const ok = expectOk(result);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.idempotent, true);
  assert.equal(ok.body.orderNumber, "1001");
});

test("posCommitSaleRouteLogic creates order, patches metadata, and remembers idempotency", async () => {
  const patched: Array<Record<string, unknown>> = [];
  const remembered: Array<{ key: string; orderNumber: string }> = [];

  const result = await posCommitSaleRouteLogic({
    body: {
      items: [{ variantId: "variant_1", quantity: 2 }],
      email: "cashier@example.com",
      offlineSaleId: "offline_1",
      shiftId: "shift_1",
      paymentMethod: "cash",
      receiptReference: "receipt_1",
    },
    correlationId: "req_1",
    idempotencyKey: "idem_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async (_orderId, metadata) => {
      patched.push(metadata);
    },
    rememberCompletedReplay: (key, orderNumber) => {
      remembered.push({ key, orderNumber });
    },
  });

  const ok = expectOk(result);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.orderNumber, "1001");
  assert.equal(ok.body.orderId, "order_1");
  assert.deepEqual(patched[0], {
    pos_offline_id: "offline_1",
    pos_idempotency_key: "idem_1",
    pos_shift_id: "shift_1",
    pos_payment_method: "cash",
    pos_receipt_reference: "receipt_1",
    pos_channel: "in_store",
  });
  assert.deepEqual(remembered[0], { key: "idem_1", orderNumber: "1001" });
});

test("posCommitSaleRouteLogic fails when Medusa draft-order creation returns no id", async () => {
  const result = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 1 }] },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({}),
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001", total: 5500 }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });

  const error = expectError(result);
  assert.equal(error.status, 502);
  assert.equal(error.body.code, "MEDUSA_UNAVAILABLE");
});

test("posCommitSaleRouteLogic fails when converted order has no usable identifiers", async () => {
  const result = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 1 }] },
    correlationId: "req_1",
    envReady: true,
    completedReplayOrderNumber: null,
    findExistingOrderByOfflineSaleId: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => ({ id: "draft_1" }),
    convertDraftToOrder: async () => ({}),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });

  const error = expectError(result);
  assert.equal(error.status, 502);
  assert.equal(error.body.code, "MEDUSA_UNAVAILABLE");
  assert.equal(
    error.body.error,
    "Converted draft order missing identifiers from the store API",
  );
});

test("posCommitSaleRouteLogic recovers a pending durable command from the order metadata", async () => {
  let created = false;
  let completed = false;
  const result = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 1 }], offlineSaleId: "offline_1" },
    correlationId: "req_1",
    idempotencyKey: "idem_recover",
    envReady: true,
    completedReplayOrderNumber: null,
    claimDurableCommand: async () => "pending",
    findExistingOrderByOfflineSaleId: async () => ({ id: "order_1", displayId: "1001" }),
    completeDurableCommand: async () => { completed = true; },
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => { created = true; return { id: "draft_1" }; },
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001" }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });
  assert.equal(result.status, 200);
  assert.equal(created, false);
  assert.equal(completed, true);
  assert.equal(result.logPhase, "ok");
});

test("posCommitSaleRouteLogic does not create a second order for an unresolved pending command", async () => {
  let created = false;
  const result = await posCommitSaleRouteLogic({
    body: { items: [{ variantId: "variant_1", quantity: 1 }] },
    correlationId: "req_1",
    idempotencyKey: "idem_pending",
    envReady: true,
    completedReplayOrderNumber: null,
    claimDurableCommand: async () => "pending",
    findExistingOrderByOfflineSaleId: async () => null,
    findExistingOrderByIdempotencyKey: async () => null,
    assertStock: async () => ({ ok: true }),
    loadShiftStatus: async () => "open",
    evaluatePolicy: () => ({ allowed: true, violations: [] }),
    createDraftOrder: async () => { created = true; return { id: "draft_1" }; },
    convertDraftToOrder: async () => ({ id: "order_1", display_id: "1001" }),
    patchOrderMetadata: async () => {},
    rememberCompletedReplay: () => {},
  });
  assert.equal(result.status, 409);
  assert.equal(created, false);
});
