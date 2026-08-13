import assert from "node:assert/strict";
import test from "node:test";
import { campaignScheduleMatches } from "./campaign-schedule.js";

test("campaign schedules match UTC minute fields", () => {
  const date = new Date("2026-08-11T09:15:00.000Z");
  assert.equal(campaignScheduleMatches("15 9 * * *", date), true);
  assert.equal(campaignScheduleMatches("*/10 * * * *", date), false);
  assert.equal(campaignScheduleMatches("15 9 11 8 2", date), true);
  assert.equal(campaignScheduleMatches("15 9 10 8 2", date), false);
});
