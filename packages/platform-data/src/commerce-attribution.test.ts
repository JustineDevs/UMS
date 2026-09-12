import assert from "node:assert/strict";
import test from "node:test";
import { linkCommerceAttributionOrder, recordCommerceAttribution, recordCommerceAttributionRefund } from "./commerce-attribution.js";

function fakeClient(calls: Array<Record<string, unknown>>) {
  return { from(table: string) {
    const state: Record<string, unknown> = { table };
    calls.push(state);
    const chain = {
      upsert(value: unknown) { state.upsert = value; return chain; },
      update(value: unknown) { state.update = value; return chain; },
      insert(value: unknown) { state.insert = value; return chain; },
      eq(key: string, value: unknown) { state[key] = value; return chain; },
      then(resolve: (_value: unknown) => unknown) { return resolve({ error: null }); },
    };
    return chain;
  }} as never;
}

test("attribution persists cart, order link, and refund with canonical currency", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = fakeClient(calls);
  await recordCommerceAttribution(client, { cartId: "cart_1", attribution: { campaign: "spring" } });
  await linkCommerceAttributionOrder(client, { cartId: "cart_1", orderId: "order_1" });
  await recordCommerceAttributionRefund(client, { orderId: "order_1", refundId: "refund_1", amountMinor: 100, currency: "php" });
  assert.deepEqual(calls.map((call) => call.table), ["commerce_attribution", "commerce_attribution", "commerce_attribution_refunds"]);
  assert.equal((calls[2].insert as { currency: string }).currency, "PHP");
});
