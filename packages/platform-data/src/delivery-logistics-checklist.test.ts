import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_LOGISTICS_CHECKLIST,
  DELIVERY_LOGISTICS_SUPPORTED_APPS,
  buildDeliveryLogisticsCoverageMetadata,
} from "./delivery-logistics-checklist.js";

test("delivery logistics checklist exposes the canonical operational groups", () => {
  const keys = DELIVERY_LOGISTICS_CHECKLIST.map((group) => group.key);
  assert.deepEqual(keys, [
    "oms_ingestion",
    "dispatch_and_routing",
    "tracking_and_execution",
    "proof_of_delivery",
    "settlement_and_reconciliation",
  ]);
});

test("delivery logistics supported apps include the current fulfillment stack", () => {
  const labels = DELIVERY_LOGISTICS_SUPPORTED_APPS.map((app) => app.label);
  assert.ok(labels.includes("J&T Express Philippines"));
  assert.ok(labels.includes("Pancake POS"));
  assert.ok(labels.includes("GrabExpress Philippines"));
});

test("delivery logistics coverage metadata counts the checklist accurately", () => {
  const meta = buildDeliveryLogisticsCoverageMetadata();
  assert.equal(meta.coverage.total, 23);
  assert.equal(meta.coverage.covered, 12);
  assert.equal(meta.coverage.partial, 11);
  assert.equal(meta.coverage.planned, 0);
  assert.equal(meta.checklist.length, DELIVERY_LOGISTICS_CHECKLIST.length);
});
