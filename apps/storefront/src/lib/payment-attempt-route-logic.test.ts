import assert from "node:assert/strict";
import test from "node:test";

import {
  codPlaceOrderRouteLogic,
  finalizeCheckoutIntentRouteLogic,
  finalizePaymentAttemptsCronRouteLogic,
  internalReconcilePaymentAttemptRouteLogic,
  registerCheckoutIntentRouteLogic,
  type FinalizeMedusaCartResult,
} from "./payment-attempt-route-logic";

function okResult(orderId = "order_123"): FinalizeMedusaCartResult {
  return {
    ok: true,
    orderId,
    redirectUrl: `/track/${orderId}`,
    attempts: 2,
  };
}

function notReadyResult(
  error = "Order not ready",
  status = 409,
): FinalizeMedusaCartResult {
  return {
    ok: false,
    status,
    error,
    attempts: 2,
  };
}

test("registerCheckoutIntentRouteLogic rejects missing cart", async () => {
  const result = await registerCheckoutIntentRouteLogic({
    cartId: null,
    provider: "stripe",
    amountMinor: 100,
    currencyCode: "PHP",
    supabaseAvailable: true,
    registerPaymentAttempt: async () => ({ correlationId: "corr", reused: false }),
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "No active cart" });
});

test("registerCheckoutIntentRouteLogic registers durable attempt", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const result = await registerCheckoutIntentRouteLogic({
    cartId: "cart_123",
    provider: "paypal",
    amountMinor: 12500,
    currencyCode: "PHP",
    quoteFingerprint: "qf_123",
    variantIds: ["variant_1"],
    productIds: ["prod_1"],
    providerSessionId: "paypal_order_1",
    supabaseAvailable: true,
    registerPaymentAttempt: async (input) => {
      calls.push(input);
      return { correlationId: "corr_123", reused: true };
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    correlationId: "corr_123",
    cartId: "cart_123",
    reused: true,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].providerSessionId, "paypal_order_1");
  assert.equal(calls[0].quoteFingerprint, "qf_123");
});

test("registerCheckoutIntentRouteLogic requires quote fingerprint", async () => {
  const result = await registerCheckoutIntentRouteLogic({
    cartId: "cart_123",
    provider: "paypal",
    amountMinor: 12500,
    currencyCode: "PHP",
    supabaseAvailable: true,
    registerPaymentAttempt: async () => ({ correlationId: "corr_123", reused: false }),
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "quoteFingerprint is required" });
});

test("finalizeCheckoutIntentRouteLogic marks awaiting completion when Medusa is not ready", async () => {
  const patches: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_1",
    cartId: "cart_1",
    row: {
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
      quote_fingerprint: "qf_live",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => notReadyResult(),
    logEvent: (payload) => {
      events.push(payload as Record<string, unknown>);
    },
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, { error: "Order not ready" });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].status, "paid_awaiting_order");
  assert.equal(events[0].outcome, "failure");
});

test("finalizeCheckoutIntentRouteLogic marks attempt completed on success", async () => {
  const patches: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_1",
    cartId: "cart_1",
    row: {
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
      quote_fingerprint: "qf_live",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => okResult("order_999"),
    logEvent: (payload) => {
      events.push(payload as Record<string, unknown>);
    },
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    orderId: "order_999",
    redirectUrl: "/track/order_999",
  });
  assert.equal(patches[0].status, "completed");
  assert.equal(patches[0].medusa_order_id, "order_999");
  assert.equal(events[0].outcome, "success");
});

test("finalizeCheckoutIntentRouteLogic rejects cart mismatch", async () => {
  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_1",
    cartId: "cart_1",
    row: {
      cart_id: "cart_other",
      correlation_id: "corr_1",
      provider: "stripe",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeMedusaCart: async () => okResult(),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "Cart mismatch" });
});

test("finalizeCheckoutIntentRouteLogic rejects missing payment attempts", async () => {
  const events: Array<Record<string, unknown>> = [];

  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_missing",
    cartId: "cart_1",
    row: null,
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeMedusaCart: async () => okResult(),
    logEvent: (payload) => {
      events.push(payload as Record<string, unknown>);
    },
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: "This checkout session could not be found. Start checkout again before completing payment.",
  });
  assert.equal(events[0]?.errorCode, "missing_attempt");
});

test("finalizeCheckoutIntentRouteLogic rejects COD attempts on hosted finalize route", async () => {
  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_cod",
    cartId: "cart_cod",
    row: {
      cart_id: "cart_cod",
      correlation_id: "corr_cod",
      provider: "cod",
      quote_fingerprint: "qf_live",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeMedusaCart: async () => okResult(),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: "This payment session belongs to cash on delivery. Use the COD completion flow instead.",
  });
});

test("finalizeCheckoutIntentRouteLogic expires stale quote mismatches", async () => {
  const patches: Array<Record<string, unknown>> = [];

  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_1",
    cartId: "cart_1",
    row: {
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
      quote_fingerprint: "qf_old",
    },
    currentQuoteFingerprint: "qf_new",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => okResult(),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 409);
  assert.equal(typeof result.body.error, "string");
  assert.equal(patches[0]?.status, "expired");
});

test("finalizeCheckoutIntentRouteLogic expires legacy rows without quote fingerprints", async () => {
  const patches: Array<Record<string, unknown>> = [];

  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId: "corr_legacy",
    cartId: "cart_legacy",
    row: {
      cart_id: "cart_legacy",
      correlation_id: "corr_legacy",
      provider: "stripe",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => okResult(),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "This checkout session is outdated and needs a fresh review before payment can continue.",
  });
  assert.equal(patches[0]?.status, "expired");
});

test("codPlaceOrderRouteLogic rejects non-COD attempt rows", async () => {
  const result = await codPlaceOrderRouteLogic({
    correlationId: "corr_1",
    cartId: "cart_1",
    row: {
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeMedusaCart: async () => okResult(),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "Not a COD attempt" });
});

test("codPlaceOrderRouteLogic rejects missing payment attempts", async () => {
  const result = await codPlaceOrderRouteLogic({
    correlationId: "corr_missing",
    cartId: "cart_cod",
    row: null,
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeMedusaCart: async () => okResult(),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    error: "This checkout session could not be found. Start checkout again before completing payment.",
  });
});

test("codPlaceOrderRouteLogic marks attempts for review when finalize throws", async () => {
  const patches: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

  const result = await codPlaceOrderRouteLogic({
    correlationId: "corr_cod",
    cartId: "cart_cod",
    row: {
      cart_id: "cart_cod",
      correlation_id: "corr_cod",
      provider: "cod",
      quote_fingerprint: "qf_live",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => {
      throw new Error("Complete failed");
    },
    logEvent: (payload) => {
      events.push(payload as Record<string, unknown>);
    },
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: "Complete failed" });
  assert.equal(patches[0]?.status, "needs_review");
  assert.equal(events[0]?.errorCode, "exception");
});

test("codPlaceOrderRouteLogic completes order exactly once per correlation", async () => {
  const patches: Array<Record<string, unknown>> = [];

  const result = await codPlaceOrderRouteLogic({
    correlationId: "corr_cod",
    cartId: "cart_cod",
    row: {
      cart_id: "cart_cod",
      correlation_id: "corr_cod",
      provider: "cod",
      quote_fingerprint: "qf_live",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => okResult("order_cod"),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.orderId, "order_cod");
  assert.equal(patches[0].status, "completed");
});

test("codPlaceOrderRouteLogic expires stale quote mismatches", async () => {
  const patches: Array<Record<string, unknown>> = [];

  const result = await codPlaceOrderRouteLogic({
    correlationId: "corr_cod",
    cartId: "cart_cod",
    row: {
      cart_id: "cart_cod",
      correlation_id: "corr_cod",
      provider: "cod",
      quote_fingerprint: "qf_old",
    },
    currentQuoteFingerprint: "qf_new",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => okResult("order_cod"),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 409);
  assert.equal(patches[0]?.status, "expired");
});

test("codPlaceOrderRouteLogic expires legacy rows without quote fingerprints", async () => {
  const patches: Array<Record<string, unknown>> = [];

  const result = await codPlaceOrderRouteLogic({
    correlationId: "corr_legacy_cod",
    cartId: "cart_legacy_cod",
    row: {
      cart_id: "cart_legacy_cod",
      correlation_id: "corr_legacy_cod",
      provider: "cod",
    },
    currentQuoteFingerprint: "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    finalizeMedusaCart: async () => okResult("order_cod"),
    logEvent: () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "This checkout session is outdated and needs a fresh review before payment can continue.",
  });
  assert.equal(patches[0]?.status, "expired");
});

test("internalReconcilePaymentAttemptRouteLogic requires secret and known row", async () => {
  const unauthorized = await internalReconcilePaymentAttemptRouteLogic({
    configuredSecret: "expected",
    providedSecret: "wrong",
    correlationId: "corr_1",
    row: {
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
    },
    supabaseAvailable: true,
    finalizeMedusaCart: async () => okResult(),
    updatePaymentAttempt: async () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });
  assert.equal(unauthorized.status, 401);

  const notFound = await internalReconcilePaymentAttemptRouteLogic({
    configuredSecret: "expected",
    providedSecret: "expected",
    correlationId: "corr_1",
    row: null,
    supabaseAvailable: true,
    finalizeMedusaCart: async () => okResult(),
    updatePaymentAttempt: async () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });
  assert.equal(notFound.status, 404);
});

test("internalReconcilePaymentAttemptRouteLogic completes a known hosted payment row", async () => {
  const patches: Array<Record<string, unknown>> = [];

  const result = await internalReconcilePaymentAttemptRouteLogic({
    configuredSecret: "expected",
    providedSecret: "expected",
    correlationId: "corr_1",
    row: {
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
    },
    supabaseAvailable: true,
    finalizeMedusaCart: async () => okResult("order_reconciled"),
    updatePaymentAttempt: async (_id, patch) => {
      patches.push(patch);
    },
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.orderId, "order_reconciled");
  assert.equal(patches[0]?.status, "completed");
});

test("finalizePaymentAttemptsCronRouteLogic rejects wrong secret", async () => {
  const result = await finalizePaymentAttemptsCronRouteLogic({
    configuredSecret: "expected",
    providedSecret: "wrong",
    supabaseAvailable: true,
    stuckRows: [],
    finalizeMedusaCart: async () => okResult(),
    updatePaymentAttempt: async () => {},
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "Unauthorized" });
});

test("finalizePaymentAttemptsCronRouteLogic updates completed and errored rows", async () => {
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let calls = 0;

  const result = await finalizePaymentAttemptsCronRouteLogic({
    configuredSecret: "cron-secret",
    providedSecret: "cron-secret",
    supabaseAvailable: true,
    stuckRows: [
      { correlation_id: "corr_ok", cart_id: "cart_ok" },
      { correlation_id: "corr_fail", cart_id: "cart_fail" },
    ],
    finalizeMedusaCart: async (cartId) => {
      calls += 1;
      return cartId === "cart_ok" ? okResult("order_ok") : notReadyResult("still pending");
    },
    updatePaymentAttempt: async (id, patch) => {
      patches.push({ id, patch });
    },
    nowIso: () => "2026-04-05T00:00:00.000Z",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.processed, 2);
  assert.equal(result.body.completed, 1);
  const errors = result.body.errors as string[];
  assert.equal(errors.length, 1);
  assert.equal(calls, 2);
  assert.equal(
    patches.find((entry) => entry.id === "corr_ok")?.patch.status,
    "completed",
  );
  assert.equal(
    typeof patches.find((entry) => entry.id === "corr_fail")?.patch.last_error,
    "string",
  );
});
