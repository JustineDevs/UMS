import assert from "node:assert/strict";
import test from "node:test";
import { fetchPaymentAttemptInvalidationDayBuckets } from "./payment-ledger.js";

test("payment invalidation buckets apply the organization scope", async () => {
  const calls: Array<[string, string, unknown]> = [];
  const query = {
    select() { return this; },
    not(column: string, operator: string, _value: unknown) { calls.push(["not", column, null]); assert.equal(operator, "is"); return this; },
    gte(column: string, value: unknown) { calls.push(["gte", column, value]); return this; },
    eq(column: string, value: unknown) { calls.push(["eq", column, value]); return this; },
    then(resolve: (_value: { data: Array<{ invalidated_at: string }>; error: null }) => unknown) { return Promise.resolve(resolve({ data: [{ invalidated_at: "2026-09-21T00:00:00.000Z" }], error: null })); },
  };
  const client = { from: () => query } as never;
  const buckets = await fetchPaymentAttemptInvalidationDayBuckets(client, 14, "org_1");
  assert.deepEqual(buckets, [{ day: "2026-09-21", count: 1 }]);
  assert.deepEqual(calls.find(([kind]) => kind === "eq"), ["eq", "organization_id", "org_1"]);
});
