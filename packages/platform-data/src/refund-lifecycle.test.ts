import assert from "node:assert/strict";
import test from "node:test";
import { assertRefundTransition, recordRefundLifecycle } from "./refund-lifecycle.js";

test("refund lifecycle permits retry and rejects terminal reversal", () => {
  assert.doesNotThrow(() => assertRefundTransition("failed", "pending"));
  assert.throws(() => assertRefundTransition("succeeded", "pending"), /Invalid refund transition/);
});

test("refund lifecycle writes one RPC payload for all projections", async () => {
  let call: { name: string; args: Record<string, unknown> } | undefined;
  const result = await recordRefundLifecycle({ rpc: async (name: string, args: Record<string, unknown>) => { call = { name, args }; return { data: { status: "pending" }, error: null }; } } as never, { organizationId: "org_1", refundId: "refund_1", orderId: "order_1", amountMinor: 500, currency: "php", status: "pending", idempotencyKey: "evt_1" });
  assert.equal(result.status, "pending");
  assert.equal(call?.name, "record_refund_lifecycle");
  assert.equal(call?.args.p_currency, "PHP");
});
