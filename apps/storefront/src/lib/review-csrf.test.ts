import assert from "node:assert/strict";
import test from "node:test";
import { createReviewCsrfToken, verifyReviewCsrfToken } from "./review-csrf";

test("review CSRF tokens require the matching cookie and valid signature", () => {
  const token = createReviewCsrfToken();
  assert.equal(verifyReviewCsrfToken(token, token), true);
  assert.equal(verifyReviewCsrfToken(token, `${token}x`), false);
  assert.equal(verifyReviewCsrfToken("invalid", token), false);
});
