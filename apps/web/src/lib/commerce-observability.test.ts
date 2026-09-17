import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedClientCommerceEvent,
  logCommerceObservabilityServer,
  sanitizeCommerceObservabilityPayload,
} from "./commerce-observability";
import { logCheckoutCompletionEvent } from "./checkout-telemetry";

test("client commerce telemetry excludes financial completion authority", () => {
  assert.equal(isAllowedClientCommerceEvent("checkout_quote_changed"), true);
  assert.equal(isAllowedClientCommerceEvent("payment_session_completed"), true);
  assert.equal(isAllowedClientCommerceEvent("order_created"), false);
  assert.equal(isAllowedClientCommerceEvent("payment_captured"), false);
  assert.equal(isAllowedClientCommerceEvent("catalog_scan_completed"), false);
  assert.equal(isAllowedClientCommerceEvent(42), false);
});

test("client commerce telemetry keeps only bounded non-secret properties", () => {
  assert.deepEqual(
    sanitizeCommerceObservabilityPayload({
      cart_id: "cart_123",
      action_kind: "redirect",
      redirect_url: "https://provider.invalid/secret",
      actorEmail: "customer@example.com",
      oversized: "x".repeat(500),
      retryCount: 2,
    }),
    { action_kind: "redirect" },
  );
});

test("server commerce logs do not emit cart or order identifiers", () => {
  const original = console.log;
  const lines: string[] = [];
  console.log = (line?: unknown) => lines.push(String(line));
  try {
    logCommerceObservabilityServer("payment_session_completed", {
      correlationId: "corr_123",
      cartId: "cart_private",
      orderId: "order_private",
    });
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.includes("cart_private"), false);
  assert.equal(lines[0]?.includes("order_private"), false);
  assert.equal(lines[0]?.includes('"cart_present":true'), true);
  assert.equal(lines[0]?.includes('"order_present":true'), true);
});

test("checkout completion logs retain correlation fields without raw IDs", () => {
  const original = console.info;
  const lines: string[] = [];
  console.info = (line?: unknown) => lines.push(String(line));
  try {
    logCheckoutCompletionEvent({
      stage: "cod_place_order",
      outcome: "success",
      cartIdSuffix: "cart_private",
      orderId: "order_private",
    });
  } finally {
    console.info = original;
  }
  assert.equal(lines[0]?.includes("cart_private"), false);
  assert.equal(lines[0]?.includes("order_private"), false);
  assert.equal(lines[0]?.includes('"cart_id_present":true'), true);
  assert.equal(lines[0]?.includes('"order_id_present":true'), true);
});
