import assert from "node:assert/strict";
import test from "node:test";
import { requiresStorefrontOnboarding } from "./OnboardingGuard";

test("onboarding only gates profile-dependent storefront flows", () => {
  assert.equal(requiresStorefrontOnboarding("/account"), true);
  assert.equal(requiresStorefrontOnboarding("/account/orders"), true);
  assert.equal(requiresStorefrontOnboarding("/checkout"), true);
  assert.equal(requiresStorefrontOnboarding("/wishlist"), true);
  assert.equal(requiresStorefrontOnboarding("/shop/merch-pack"), false);
  assert.equal(requiresStorefrontOnboarding("/contact"), false);
  assert.equal(requiresStorefrontOnboarding("/api/account/profile/status"), false);
});
