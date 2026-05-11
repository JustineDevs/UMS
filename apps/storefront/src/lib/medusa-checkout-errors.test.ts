import test from "node:test";
import assert from "node:assert/strict";
import { MedusaAdminConfigurationError } from "./medusa-admin-configuration-error";
import { formatMedusaCheckoutError } from "./medusa-checkout-errors";

test("formatMedusaCheckoutError maps MedusaAdminConfigurationError to a safe message", () => {
  const msg = formatMedusaCheckoutError(new MedusaAdminConfigurationError());
  assert.match(msg, /temporarily unavailable/i);
  assert.doesNotMatch(msg, /MEDUSA_SECRET/i);
});

test("formatMedusaCheckoutError hides raw env configuration errors", () => {
  const msg = formatMedusaCheckoutError(
    new Error("MEDUSA_SECRET_API_KEY is not set"),
  );
  assert.match(msg, /temporarily unavailable/i);
  assert.doesNotMatch(msg, /MEDUSA_SECRET/i);
});
