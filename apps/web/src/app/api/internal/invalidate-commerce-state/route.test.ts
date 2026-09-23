import assert from "node:assert/strict";
import test from "node:test";
import { resolveInternalInvalidationSecret } from "@/lib/internal-invalidation-secret";

test("internal invalidation prefers the configured secret in every environment", () => {
  assert.equal(
    resolveInternalInvalidationSecret({
      NODE_ENV: "production",
      STOREFRONT_INTERNAL_INVALIDATION_SECRET: "configured",
      __PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET: "test-only",
    }),
    "configured",
  );
});

test("internal invalidation does not accept the Playwright fallback in production", () => {
  assert.equal(
    resolveInternalInvalidationSecret({
      NODE_ENV: "production",
      __PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET: "test-only",
    }),
    undefined,
  );
});

test("internal invalidation permits the Playwright fallback only outside production", () => {
  assert.equal(
    resolveInternalInvalidationSecret({
      NODE_ENV: "test",
      __PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET: "test-only",
    }),
    "test-only",
  );
});
