import assert from "node:assert/strict";
import test from "node:test";
import { activityMetrics, crmDeduplicationKey, forecastPipeline, normalizeCrmEmail, routeLead, scoreLead } from "./crm-operations.js";

test("CRM operations normalize, score, route, forecast, and measure activity", () => {
  assert.equal(normalizeCrmEmail(" Buyer@Example.COM "), "buyer@example.com");
  assert.equal(crmDeduplicationKey({ email: "buyer@example.com", company: "Acme" }), "buyer@example.com:acme");
  const score = scoreLead({ email: "buyer@example.com", totalSpent: 50_000, orderCount: 3, source: "referral" });
  assert.ok(score >= 50);
  assert.equal(routeLead(score, ["a@example.com", "b@example.com"]), score % 2 ? "b@example.com" : "a@example.com");
  assert.deepEqual(forecastPipeline([{ value: 1000, probability: 0.5, closeDate: "2026-08-15" }], new Date("2026-08-01")), { weightedValue: 500, openValue: 1000, dueThisMonth: 500 });
  assert.deepEqual(activityMetrics([{ type: "task", occurredAt: "2020-01-01", ownerEmail: "a@example.com" }]), { "a@example.com": { total: 1, completed: 0, overdue: 1 } });
});
