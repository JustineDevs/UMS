import assert from "node:assert/strict";
import test from "node:test";
import { handlePayPalConfirmationRequest } from "./paypal-confirm.ts";

function database(rows: Array<Record<string, unknown>>, statements: string[] = []) {
  return {
    async query<T extends Record<string, unknown>>(text: string): Promise<{ rows: T[]; rowCount: number }> {
      statements.push(text);
      return { rows: (text.startsWith("SELECT") ? rows : []) as T[], rowCount: rows.length };
    },
    async end() {},
  };
}

test("requires an idempotency key before provider work", async () => {
  const response = await handlePayPalConfirmationRequest(
    new Request("https://api.test/store/checkout/paypal/confirm", {
      method: "POST",
      body: JSON.stringify({ correlationId: "8f7d7c0e-3bd2-4b42-a3dc-2df16c6f62a1", orderId: "ORDER-1" }),
    }),
    database([]),
    {},
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "idempotency_key_required" });
});

test("rejects a PayPal order that is not owned by the checkout cookies", async () => {
  const response = await handlePayPalConfirmationRequest(
    new Request("https://api.test/store/checkout/paypal/confirm", {
      method: "POST",
      headers: { "Idempotency-Key": "confirm-1" },
      body: JSON.stringify({ correlationId: "8f7d7c0e-3bd2-4b42-a3dc-2df16c6f62a1", orderId: "ORDER-1" }),
    }),
    database([{ cart_id: "cart-1", provider: "paypal", provider_session_id: "ORDER-1", amount_minor: 599700, currency: "PHP", status: "initiated" }]),
    {},
  );
  assert.equal(response.status, 404);
});

test("replays a previously paid PayPal attempt without calling the provider", async () => {
  const response = await handlePayPalConfirmationRequest(
    new Request("https://api.test/store/checkout/paypal/confirm", {
      method: "POST",
      headers: { "Idempotency-Key": "confirm-2", Cookie: "mcart_id=cart-1" },
      body: JSON.stringify({ correlationId: "8f7d7c0e-3bd2-4b42-a3dc-2df16c6f62a1", orderId: "ORDER-1" }),
    }),
    database([{ cart_id: "cart-1", provider: "paypal", provider_session_id: "ORDER-1", amount_minor: 599700, currency: "PHP", status: "paid" }]),
    {},
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, correlationId: "8f7d7c0e-3bd2-4b42-a3dc-2df16c6f62a1" });
});
