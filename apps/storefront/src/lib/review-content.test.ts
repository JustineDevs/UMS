import assert from "node:assert/strict";
import test from "node:test";
import { reviewFormTimingIsValid, validateReviewBody } from "./review-content";

test("review content rejects unsafe or meaningless input", () => {
  assert.equal(validateReviewBody("<script>alert(1)</script>").ok, false);
  assert.equal(validateReviewBody("visit https://example.com").ok, false);
  assert.equal(validateReviewBody("asdfghjk").ok, false);
  assert.equal(validateReviewBody("Great guitar tone").ok, true);
});

test("review content preserves display casing while hashing normalized text", () => {
  const result = validateReviewBody(" Great Guitar Tone ");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.cleaned, "Great Guitar Tone");
    assert.equal(result.normalized, "great guitar tone");
  }
});

test("review form timing rejects future timestamps and fast submissions", () => {
  const now = Date.parse("2026-08-22T12:00:00.000Z");
  assert.equal(reviewFormTimingIsValid(now - 2_000, now), true);
  assert.equal(reviewFormTimingIsValid(now - 1_999, now), false);
  assert.equal(reviewFormTimingIsValid(now + 6_000, now), false);
});
