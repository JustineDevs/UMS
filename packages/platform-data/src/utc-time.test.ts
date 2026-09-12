import assert from "node:assert/strict";
import test from "node:test";
import { reportDateKey, toUtcStorageTimestamp, utcDateRange } from "./utc-time.js";

test("storage timestamps are canonical UTC", () => {
  assert.equal(toUtcStorageTimestamp("2026-08-15T23:59:59+08:00"), "2026-08-15T15:59:59.000Z");
});

test("date ranges use midnight UTC and an exclusive next midnight", () => {
  const range = utcDateRange("2026-08-15", "2026-08-16");
  assert.equal(range.start.toISOString(), "2026-08-15T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-08-17T00:00:00.000Z");
  assert.equal(utcDateRange("2026-08-15").end.toISOString(), "2026-08-16T00:00:00.000Z");
});

test("report conversion owns the timezone boundary at midnight", () => {
  assert.equal(reportDateKey("2026-08-15T15:59:59.999Z"), "2026-08-15");
  assert.equal(reportDateKey("2026-08-15T16:00:00.000Z"), "2026-08-16");
});
