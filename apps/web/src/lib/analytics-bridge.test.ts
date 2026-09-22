import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalyticsDataLimitError,
  MAX_ANALYTICS_ORDERS,
  assertAnalyticsOrderBudget,
} from "./analytics-bridge";

test("analytics order collection rejects totals beyond the memory safety ceiling", () => {
  assert.doesNotThrow(() => assertAnalyticsOrderBudget(MAX_ANALYTICS_ORDERS, MAX_ANALYTICS_ORDERS));
  assert.throws(
    () => assertAnalyticsOrderBudget(MAX_ANALYTICS_ORDERS + 1, 0),
    (error) => error instanceof AnalyticsDataLimitError && error.code === "ANALYTICS_DATA_LIMIT",
  );
  assert.throws(
    () => assertAnalyticsOrderBudget(100, MAX_ANALYTICS_ORDERS + 1),
    AnalyticsDataLimitError,
  );
});
