import assert from "node:assert/strict";
import test from "node:test";

import { medusaComplianceFailure } from "./medusa-compliance-fetch.js";

test("compliance failures contain only operation and status", () => {
  assert.equal(medusaComplianceFailure("orders", 502), "medusa_orders_502");
  assert.equal(medusaComplianceFailure("delete", 503), "medusa_delete_503");
  assert.equal(medusaComplianceFailure("orders", 502).includes("token="), false);
});
