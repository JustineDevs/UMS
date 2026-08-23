import assert from "node:assert/strict";
import test from "node:test";

import {
  validateCartResumeQuery,
  validateCartSessionBinding,
  cartEmailMatchesOwner,
  validateExistingCartBinding,
} from "./cart-session-boundary";

test("bind rejects a foreign cart when the session is already bound", () => {
  assert.deepEqual(validateCartSessionBinding("cart_foreign", "cart_owned"), {
    status: 403,
    body: { error: "Cart ownership could not be verified" },
  });
});

test("bind establishes and repeats the same session cart", () => {
  assert.equal(validateCartSessionBinding("cart_owned", null).status, 200);
  assert.equal(
    validateCartSessionBinding("cart_owned", "cart_owned").status,
    200,
  );
});

test("existing-cart mutations require a bound cart", () => {
  assert.equal(validateExistingCartBinding("cart_owned", null).status, 403);
  assert.equal(
    validateExistingCartBinding("cart_foreign", "cart_owned").status,
    403,
  );
  assert.equal(
    validateExistingCartBinding("cart_owned", "cart_owned").status,
    200,
  );
});

test("cart attachment rejects a cart already owned by another email", () => {
  assert.equal(cartEmailMatchesOwner(null, "buyer@example.com"), true);
  assert.equal(cartEmailMatchesOwner("", "buyer@example.com"), true);
  assert.equal(
    cartEmailMatchesOwner("BUYER@example.com", "buyer@example.com"),
    true,
  );
  assert.equal(
    cartEmailMatchesOwner("other@example.com", "buyer@example.com"),
    false,
  );
});

test("bind accepts a valid proof when replacing a stale cookie cart", () => {
  assert.equal(
    validateCartSessionBinding("cart_new", "cart_old", true).status,
    200,
  );
});

test("resume rejects a foreign cart query", () => {
  assert.equal(validateCartResumeQuery("cart_foreign", "cart_owned"), false);
  assert.equal(validateCartResumeQuery("cart_owned", "cart_owned"), true);
  assert.equal(validateCartResumeQuery(null, "cart_owned"), true);
});

test("resume accepts only a valid cart-scoped recovery capability", async () => {
  const previous = process.env.TRACKING_HMAC_SECRET;
  process.env.TRACKING_HMAC_SECRET = "resume-test-secret";
  try {
    const { generateOpaqueTrackingCapability, generateTrackingCapability } =
      await import("@universal-music-store/sdk");
    const { resolveCartResumeCapability, validateCartResumeAccess } =
      await import("./cart-session-boundary");
    const token = generateOpaqueTrackingCapability("cart_foreign");
    assert.equal(resolveCartResumeCapability(token), "cart_foreign");
    assert.equal(validateCartResumeAccess("cart_foreign", null, token), true);
    assert.equal(validateCartResumeAccess("cart_other", null, token), false);
    const legacyToken = generateTrackingCapability("cart_foreign");
    assert.equal(
      validateCartResumeAccess("cart_foreign", null, legacyToken),
      true,
    );
    assert.equal(
      validateCartResumeAccess("cart_foreign", null, "v1.invalid"),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.TRACKING_HMAC_SECRET;
    else process.env.TRACKING_HMAC_SECRET = previous;
  }
});
