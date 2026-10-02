import assert from "node:assert/strict";
import test from "node:test";

import { handleCodPlaceOrderRequest } from "./cod-place-order-route-handler";

test("handleCodPlaceOrderRequest rejects invalid JSON at the live handler boundary", async () => {
  const req = new Request("http://localhost/api/checkout/cod-place-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

  const res = await handleCodPlaceOrderRequest(req, {
    applyRateLimit: async () => ({ ok: true }),
    readCartIdFromCookie: async () => "cart_1",
    getPaymentAttemptRow: async () => null,
    readCurrentQuoteFingerprint: async () => "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeCheckout: async () => ({
      ok: true,
      orderId: "order_1",
      redirectUrl: "/track/order_1",
      attempts: 1,
    }),
    logEvent: () => {},
    nowIso: () => "2026-04-06T00:00:00.000Z",
  });

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid JSON" });
});

test("handleCodPlaceOrderRequest rejects non-COD rows through handler wiring", async () => {
  const req = new Request("http://localhost/api/checkout/cod-place-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correlationId: "corr_1" }),
  });

  const res = await handleCodPlaceOrderRequest(req, {
    applyRateLimit: async () => ({ ok: true }),
    readCartIdFromCookie: async () => "cart_1",
    getPaymentAttemptRow: async () => ({
      cart_id: "cart_1",
      correlation_id: "corr_1",
      provider: "stripe",
    }),
    readCurrentQuoteFingerprint: async () => "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeCheckout: async () => ({
      ok: true,
      orderId: "order_1",
      redirectUrl: "/track/order_1",
      attempts: 1,
    }),
    logEvent: () => {},
    nowIso: () => "2026-04-06T00:00:00.000Z",
  });

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Not a COD attempt" });
});

test("handleCodPlaceOrderRequest returns order redirect on success", async () => {
  const req = new Request("http://localhost/api/checkout/cod-place-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correlationId: "corr_cod" }),
  });

  const res = await handleCodPlaceOrderRequest(req, {
    applyRateLimit: async () => ({ ok: true }),
    readCartIdFromCookie: async () => "cart_cod",
    getPaymentAttemptRow: async () => ({
      cart_id: "cart_cod",
      correlation_id: "corr_cod",
      provider: "cod",
      quote_fingerprint: "qf_live",
    }),
    readCurrentQuoteFingerprint: async () => "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeCheckout: async () => ({
      ok: true,
      orderId: "order_cod",
      redirectUrl: "/track/cap_v3.opaque",
      attempts: 2,
    }),
    logEvent: () => {},
    nowIso: () => "2026-04-06T00:00:00.000Z",
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    ok: true,
    orderId: "order_cod",
    redirectUrl: "http://localhost/track/cap_v3.opaque",
  });
});

test("handleCodPlaceOrderRequest replays a completed attempt after the cart cookie is cleared", async () => {
  const previousSecret = process.env.TRACKING_HMAC_SECRET;
  process.env.TRACKING_HMAC_SECRET = "test-tracking-secret";
  let finalized = false;
  try {
    const req = new Request("http://localhost/api/checkout/cod-place-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correlationId: "corr_completed" }),
    });

    const res = await handleCodPlaceOrderRequest(req, {
      applyRateLimit: async () => ({ ok: true }),
      readCartIdFromCookie: async () => null,
      getPaymentAttemptRow: async () => ({
        cart_id: "cart_completed",
        correlation_id: "corr_completed",
        provider: "cod",
        status: "completed",
        medusa_order_id: "order_completed",
        quote_fingerprint: "qf_live",
      }),
      readCurrentQuoteFingerprint: async () => null,
      incrementFinalizeAttempts: async () => {},
      updatePaymentAttempt: async () => {},
      finalizeCheckout: async () => {
        finalized = true;
        return { ok: true, orderId: "order_unexpected", redirectUrl: "/track/cap_unexpected", attempts: 1 };
      },
      logEvent: () => {},
      nowIso: () => "2026-04-06T00:00:00.000Z",
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(finalized, false);
    assert.equal(body.ok, true);
    assert.equal(body.orderId, "order_completed");
    assert.equal(body.replayed, true);
    assert.match(body.redirectUrl, /^http:\/\/localhost\/track\/cap_/);
  } finally {
    if (previousSecret === undefined) delete process.env.TRACKING_HMAC_SECRET;
    else process.env.TRACKING_HMAC_SECRET = previousSecret;
  }
});

test("handleCodPlaceOrderRequest rejects missing correlation ids through handler wiring", async () => {
  const req = new Request("http://localhost/api/checkout/cod-place-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await handleCodPlaceOrderRequest(req, {
    applyRateLimit: async () => ({ ok: true }),
    readCartIdFromCookie: async () => "cart_cod",
    getPaymentAttemptRow: async () => null,
    readCurrentQuoteFingerprint: async () => "qf_live",
    incrementFinalizeAttempts: async () => {},
    updatePaymentAttempt: async () => {},
    finalizeCheckout: async () => ({
      ok: true,
      orderId: "order_cod",
      redirectUrl: "/track/order_cod",
      attempts: 1,
    }),
    logEvent: () => {},
    nowIso: () => "2026-04-06T00:00:00.000Z",
  });

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "correlationId is required" });
});
