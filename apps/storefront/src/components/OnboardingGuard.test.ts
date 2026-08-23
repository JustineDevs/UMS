import assert from "node:assert/strict";
import test from "node:test";
import {
  isExplicitGuestCheckout,
  requiresStorefrontOnboarding,
} from "./OnboardingGuard";

test("onboarding only gates profile-dependent storefront flows", () => {
  assert.equal(requiresStorefrontOnboarding("/account"), true);
  assert.equal(requiresStorefrontOnboarding("/account/orders"), true);
  assert.equal(requiresStorefrontOnboarding("/checkout"), true);
  assert.equal(requiresStorefrontOnboarding("/checkout/hosted-return"), false);
  assert.equal(requiresStorefrontOnboarding("/checkout/stripe-return"), false);
  assert.equal(requiresStorefrontOnboarding("/wishlist"), true);
  assert.equal(requiresStorefrontOnboarding("/shop/merch-pack"), false);
  assert.equal(requiresStorefrontOnboarding("/contact"), false);
  assert.equal(
    requiresStorefrontOnboarding("/api/account/profile/status"),
    false,
  );
});

test("explicit guest checkout is exempt from the authenticated profile guard", () => {
  assert.equal(isExplicitGuestCheckout("/checkout", "guest=1"), true);
  assert.equal(isExplicitGuestCheckout("/checkout", "guest=0"), false);
  assert.equal(isExplicitGuestCheckout("/account", "guest=1"), false);
});
