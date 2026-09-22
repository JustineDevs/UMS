import assert from "node:assert/strict";
import test from "node:test";
import { resolveCheckoutEmail } from "./checkout-email";

test("authenticated checkout keeps the canonical account email", () => {
  assert.deepEqual(
    resolveCheckoutEmail(" Buyer@Example.com ", "buyer@example.com"),
    { ok: true, email: "buyer@example.com" },
  );
});

test("authenticated checkout rejects a different receipt email", () => {
  assert.deepEqual(
    resolveCheckoutEmail("buyer@example.com", "other@example.com"),
    { ok: false, error: "account_email_mismatch" },
  );
});

test("guest checkout may provide its receipt email", () => {
  assert.deepEqual(resolveCheckoutEmail(null, " Guest@Example.com "), {
    ok: true,
    email: "guest@example.com",
  });
});

test("explicit guest checkout ignores a stale authenticated session email", () => {
  assert.deepEqual(resolveCheckoutEmail("", "guest@example.com"), {
    ok: true,
    email: "guest@example.com",
  });
});

test("checkout rejects an empty email", () => {
  assert.deepEqual(resolveCheckoutEmail(null, "  "), {
    ok: false,
    error: "missing_email",
  });
});
