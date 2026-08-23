import assert from "node:assert/strict";
import test from "node:test";
import {
  isReviewId,
  decodeReviewCursor,
  encodeReviewCursor,
  PUBLIC_REVIEW_FIELD_NAMES,
  publicReviewFieldsAreSafe,
  reviewReportBodySchema,
} from "./review-api-contract";

test("public review contract includes vote counts and excludes private moderation fields", () => {
  assert.equal(publicReviewFieldsAreSafe(), true);
  assert.ok(PUBLIC_REVIEW_FIELD_NAMES.includes("helpful_votes"));
  assert.equal(PUBLIC_REVIEW_FIELD_NAMES.includes("customer_email"), false);
  assert.equal(PUBLIC_REVIEW_FIELD_NAMES.includes("risk_score"), false);
});

test("review ids must be UUIDs before reaching vote queries", () => {
  assert.equal(isReviewId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isReviewId("review_123"), false);
  assert.equal(isReviewId("550e8400-e29b-61d4-a716-446655440000"), false);
});

test("review reports accept only bounded, known fields", () => {
  assert.deepEqual(reviewReportBodySchema.parse({
    reason: "spam",
    details: "Repeated promotional content",
    csrfToken: "csrf-token-that-is-long-enough",
  }), {
    reason: "spam",
    details: "Repeated promotional content",
    csrfToken: "csrf-token-that-is-long-enough",
  });
  assert.equal(reviewReportBodySchema.safeParse({ reason: "spam", csrfToken: "csrf-token-that-is-long-enough", unexpected: true }).success, false);
  assert.equal(reviewReportBodySchema.safeParse({ reason: "spam", csrfToken: "csrf-token-that-is-long-enough", details: "x".repeat(501) }).success, false);
  assert.equal(reviewReportBodySchema.safeParse({ reason: "invalid" }).success, false);
  assert.equal(reviewReportBodySchema.safeParse({ reason: "spam" }).success, false);
});

test("review pagination cursor preserves timestamp ties with the review id", () => {
  const cursor = encodeReviewCursor(
    "2026-08-23T05:00:00.000Z",
    "550e8400-e29b-41d4-a716-446655440000",
  );
  assert.deepEqual(decodeReviewCursor(cursor), {
    createdAt: "2026-08-23T05:00:00.000Z",
    id: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.deepEqual(decodeReviewCursor("2026-08-23T05:00:00.000Z"), {
    createdAt: "2026-08-23T05:00:00.000Z",
  });
  assert.equal(decodeReviewCursor("not-a-cursor"), null);
});
