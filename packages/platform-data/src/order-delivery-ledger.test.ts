import assert from "node:assert/strict";
import test from "node:test";
import { appendCanonicalOrderState, assertCanonicalOrderTransition, canonicalOrderStatusFor } from "./order-delivery-ledger.js";

test("canonical order ledger rejects skipped and terminal transitions", () => {
  assert.doesNotThrow(() => assertCanonicalOrderTransition("paid", "processing"));
  assert.throws(() => assertCanonicalOrderTransition("paid", "delivered"), /Invalid canonical order transition/);
  assert.throws(() => assertCanonicalOrderTransition("refunded", "paid"), /Invalid canonical order transition/);
  assert.doesNotThrow(() => assertCanonicalOrderTransition(null, "pending"));
});

test("canonical order mapping normalizes provider vocabulary", () => {
  assert.equal(canonicalOrderStatusFor("captured"), "paid");
  assert.equal(canonicalOrderStatusFor("canceled"), "cancelled");
  assert.throws(() => canonicalOrderStatusFor("unknown"), /Unsupported order status/);
});

test("canonical order persistence uses the atomic tenant-scoped RPC", async () => {
  let call: { name: string; args: Record<string, unknown> } | null = null;
  const result = await appendCanonicalOrderState({
    rpc: async (name: string, args: Record<string, unknown>) => {
      call = { name, args };
      return { data: { id: "ledger_1", status: "paid" }, error: null };
    },
  } as never, {
    organizationId: "org_1", medusaOrderId: "order_1", status: "paid",
    previousStatus: "pending", eventType: "payment_captured", source: "stripe_webhook", idempotencyKey: "event_1",
  });
  assert.equal(result.id, "ledger_1");
  assert.equal(call?.name, "append_canonical_order_state");
  assert.equal(call?.args.p_organization_id, "org_1");
});
