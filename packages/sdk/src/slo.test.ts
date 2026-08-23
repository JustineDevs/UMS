import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSloAlert, SLO_DEFINITIONS } from "./slo.js";

test("SLO alerts stay quiet while a metric is within budget", () => {
  const definition = SLO_DEFINITIONS.find((item) => item.metric === "storefront_ttfb_p95");
  assert.ok(definition);
  assert.equal(evaluateSloAlert(definition, 700).severity, "ok");
});

test("SLO alerts classify a materially breached latency budget as critical", () => {
  const definition = SLO_DEFINITIONS.find((item) => item.metric === "storefront_ttfb_p95");
  assert.ok(definition);
  const alert = evaluateSloAlert(definition, 1_200);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.withinBudget, false);
});
