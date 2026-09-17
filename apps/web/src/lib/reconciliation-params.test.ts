import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReconciliationQuery } from "./reconciliation-params";

describe("reconciliation query parsing", () => {
  it("defaults to the complete seven-day reconciliation view", () => {
    assert.deepEqual(parseReconciliationQuery(new URLSearchParams()), {
      ok: true,
      value: { days: 7, provider: "all" },
    });
  });

  it("accepts only supported providers", () => {
    assert.deepEqual(
      parseReconciliationQuery(new URLSearchParams("provider=stripe&days=14")),
      { ok: true, value: { days: 14, provider: "stripe" } },
    );
    assert.deepEqual(
      parseReconciliationQuery(new URLSearchParams("provider=other")),
      { ok: false, error: "Invalid reconciliation provider" },
    );
  });

  it("bounds hostile and non-finite day values", () => {
    const values = [
      ["days=-2", 1],
      ["days=999", 90],
      ["days=3.9", 3],
      ["days=wat", 7],
    ] as const;
    for (const [query, expectedDays] of values) {
      const parsed = parseReconciliationQuery(new URLSearchParams(query));
      assert.equal(parsed.ok, true);
      if (parsed.ok) assert.equal(parsed.value.days, expectedDays);
    }
  });
});
