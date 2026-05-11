import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_AVAILABILITY,
  isCheckoutHardUnavailableCode,
} from "./checkout-availability-codes";

test("isCheckoutHardUnavailableCode recognizes configured failure codes", () => {
  assert.equal(
    isCheckoutHardUnavailableCode(CHECKOUT_AVAILABILITY.MISSING_CHECKOUT_CONFIG),
    true,
  );
  assert.equal(isCheckoutHardUnavailableCode(CHECKOUT_AVAILABILITY.OK), false);
  assert.equal(isCheckoutHardUnavailableCode(undefined), false);
});
