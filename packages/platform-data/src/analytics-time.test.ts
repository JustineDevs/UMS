import assert from "node:assert/strict";
import test from "node:test";
import { utcMonthWindow } from "./analytics.js";

test("utcMonthWindow uses UTC month boundaries at year rollover", () => {
  const result = utcMonthWindow(new Date("2025-01-15T00:30:00+08:00"), 1);
  assert.equal(result.period, "2024-12");
  assert.equal(result.start.toISOString(), "2024-12-01T00:00:00.000Z");
  assert.equal(result.end.toISOString(), "2025-01-01T00:00:00.000Z");
});

test("utcMonthWindow rejects invalid offsets", () => {
  assert.throws(() => utcMonthWindow(new Date(), -1), /non-negative integer/);
});
