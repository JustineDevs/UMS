import assert from "node:assert/strict";
import test from "node:test";
import {
  POLICY_EFFECTIVE_DATE,
  POLICY_LAST_UPDATED,
  POLICY_VERSION,
} from "./policy-content";

test("public policy metadata is explicit and versioned", () => {
  assert.match(POLICY_VERSION, /^\d{4}\.\d{2}$/);
  assert.match(POLICY_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(POLICY_LAST_UPDATED.length > 0);
});
