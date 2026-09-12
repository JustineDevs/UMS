import assert from "node:assert/strict";
import test from "node:test";
import { reviewModerationResult } from "./review-report-moderation";

test("review moderation reports count failures instead of claiming success", () => {
  assert.deepEqual(
    reviewModerationResult({ openReportCount: null, countFailed: true, hideFailed: false }),
    {
      status: 503,
      body: { error: "Report recorded, but moderation status is temporarily unavailable" },
    },
  );
});

test("review moderation reports hide failures after the threshold", () => {
  assert.deepEqual(
    reviewModerationResult({ openReportCount: 3, countFailed: false, hideFailed: true }),
    {
      status: 503,
      body: { error: "Report recorded, but moderation could not be applied" },
    },
  );
});

test("review moderation succeeds when the report is recorded and no hide is needed", () => {
  assert.deepEqual(
    reviewModerationResult({ openReportCount: 1, countFailed: false, hideFailed: false }),
    { status: 200, body: { ok: true } },
  );
});
