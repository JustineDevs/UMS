import assert from "node:assert/strict";
import test from "node:test";

import {
  checkoutReviewHref,
  STRIPE_RETURN_MISSING_CORRELATION_MESSAGE,
} from "./stripe-return-recovery";

test("checkoutReviewHref encodes the review message for redirect safety", () => {
  const href = checkoutReviewHref("Total changed: review & retry");
  assert.equal(
    href,
    "/checkout?review=1&message=Total%20changed%3A%20review%20%26%20retry",
  );
});

test("stripe return missing correlation message stays explicit", () => {
  assert.match(STRIPE_RETURN_MISSING_CORRELATION_MESSAGE, /checkout session/i);
  assert.match(STRIPE_RETURN_MISSING_CORRELATION_MESSAGE, /account/i);
});
