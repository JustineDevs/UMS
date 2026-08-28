import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKOUT_ATTEMPT_COOKIE,
  checkoutAttemptCookieHeader,
} from "./checkout-attempt-cookie";

test("checkout attempt capability is scoped and short lived", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(CHECKOUT_ATTEMPT_COOKIE, "checkout_attempt_id");
  assert.match(
    checkoutAttemptCookieHeader(id),
    /^checkout_attempt_id=123e4567-e89b-12d3-a456-426614174000; Path=\/; Max-Age=1800; HttpOnly; SameSite=Lax(?:; Secure)?$/,
  );
});
