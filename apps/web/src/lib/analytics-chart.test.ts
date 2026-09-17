import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnalyticsChartsPayload } from "./analytics-chart";

describe("buildAnalyticsChartsPayload", () => {
  it("produces valid daily buckets and status breakdown", () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const day = today.toISOString();
    const dayKey = day.slice(0, 10);
    const result = buildAnalyticsChartsPayload(
      [
        {
          id: "o1",
          order_number: "1",
          customer_id: null,
          email: "a@b.com",
          status: "paid",
          channel: "medusa",
          currency: "PHP",
          grand_total: 100,
          created_at: day,
        },
        {
          id: "o2",
          order_number: "2",
          customer_id: null,
          email: "a@b.com",
          status: "pending",
          channel: "medusa",
          currency: "PHP",
          grand_total: 50,
          created_at: day,
        },
      ],
      { horizonDays: 7 },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const point = result.data.daily.find((d) => d.date === dayKey);
    assert.ok(point);
    assert.equal(point.orderCount, 2);
    assert.equal(point.revenue, 150);
    assert.ok(result.data.statusBreakdown.some((s) => s.name === "paid"));
  });
});
