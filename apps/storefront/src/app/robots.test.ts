import assert from "node:assert/strict";
import test from "node:test";

import robots from "./robots";

test("robots excludes token-bearing tracking and confirmation routes", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const disallowed = rules.flatMap((rule) => {
    const value = rule.disallow;
    return Array.isArray(value) ? value : value ? [value] : [];
  });

  assert.ok(disallowed.includes("/track"));
  assert.ok(disallowed.includes("/order-confirmation"));
});
