/**
 * Stress test: Medusa process env validation with mock data.
 * Run: pnpm --filter medusa test:stress
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateMedusaProcessEnv } from "./validate-process-env.ts";

const envBackup = { ...process.env };

function restoreEnv() {
  Object.keys(process.env).forEach((k) => delete process.env[k]);
  Object.assign(process.env, envBackup);
}

test.afterEach(restoreEnv);

test("validateMedusaProcessEnv: throws when DATABASE_URL missing", () => {
  process.env.DATABASE_URL = "";
  assert.throws(
    () => validateMedusaProcessEnv(),
    /DATABASE_URL is required/,
  );
});

test("validateMedusaProcessEnv: passes in development with DATABASE_URL", () => {
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgres://local:5432/test";
  assert.doesNotThrow(() => validateMedusaProcessEnv());
});

const prodCors = () => {
  process.env.STORE_CORS = "https://store.example.com";
  process.env.ADMIN_CORS = "https://admin.example.com";
  process.env.AUTH_CORS = "https://admin.example.com";
};

test("validateMedusaProcessEnv: throws in production when STORE_CORS missing", () => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://x";
  process.env.JWT_SECRET = "a";
  process.env.COOKIE_SECRET = "b";
  process.env.ADMIN_CORS = "x";
  process.env.AUTH_CORS = "x";
  assert.throws(
    () => validateMedusaProcessEnv(),
    /STORE_CORS/,
  );
});

test("validateMedusaProcessEnv: throws in production when JWT_SECRET missing", () => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://x";
  process.env.JWT_SECRET = "";
  process.env.COOKIE_SECRET = "some-secret";
  prodCors();
  assert.throws(
    () => validateMedusaProcessEnv(),
    /JWT_SECRET.*required/,
  );
});

test("validateMedusaProcessEnv: throws in production when COOKIE_SECRET missing", () => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://x";
  process.env.JWT_SECRET = "some-secret";
  process.env.COOKIE_SECRET = "";
  prodCors();
  assert.throws(
    () => validateMedusaProcessEnv(),
    /COOKIE_SECRET.*required/,
  );
});

test("validateMedusaProcessEnv: throws in production when JWT_SECRET is supersecret", () => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://x";
  process.env.JWT_SECRET = "supersecret";
  process.env.COOKIE_SECRET = "other";
  prodCors();
  assert.throws(
    () => validateMedusaProcessEnv(),
    /must not use default/,
  );
});

function setupValidProd() {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://x";
  process.env.JWT_SECRET = "real-secret-1";
  process.env.COOKIE_SECRET = "real-secret-2";
  process.env.STORE_CORS = "https://store.example.com";
  process.env.ADMIN_CORS = "https://admin.example.com";
  process.env.AUTH_CORS = "https://admin.example.com";
}

test("validateMedusaProcessEnv: throws when PayPal client ID set without secret", () => {
  setupValidProd();
  process.env.PAYPAL_CLIENT_ID = "AZDxjDScFpQ";
  delete process.env.PAYPAL_CLIENT_SECRET;
  assert.throws(
    () => validateMedusaProcessEnv(),
    /PAYPAL_CLIENT_SECRET.*required/,
  );
});

test("validateMedusaProcessEnv: throws when PayPal client ID set without webhook ID", () => {
  setupValidProd();
  process.env.PAYPAL_CLIENT_ID = "AZDxjDScFpQ";
  process.env.PAYPAL_CLIENT_SECRET = "EJp8vlxYBq";
  delete process.env.PAYPAL_WEBHOOK_ID;
  assert.throws(
    () => validateMedusaProcessEnv(),
    /PAYPAL_WEBHOOK_ID.*required/,
  );
});

test("validateMedusaProcessEnv: throws when Xendit secret is set without webhook token", () => {
  setupValidProd();
  process.env.XENDIT_SECRET_KEY = "xendit-secret";
  delete process.env.XENDIT_WEBHOOK_TOKEN;
  assert.throws(
    () => validateMedusaProcessEnv(),
    /XENDIT_WEBHOOK_TOKEN.*required/,
  );
});

test("validateMedusaProcessEnv: rejects Xendit HTTP checkout callbacks in production", () => {
  setupValidProd();
  process.env.XENDIT_SECRET_KEY = "xendit-secret";
  process.env.XENDIT_WEBHOOK_TOKEN = "xendit-webhook";
  process.env.XENDIT_CHECKOUT_SUCCESS_URL = "http://localhost:3000/success";
  process.env.XENDIT_CHECKOUT_CANCEL_URL = "https://store.example.com/cancel";
  assert.throws(
    () => validateMedusaProcessEnv(),
    /XENDIT_CHECKOUT_SUCCESS_URL must be an absolute HTTPS URL/,
  );
});

test("validateMedusaProcessEnv: accepts complete Xendit HTTPS callbacks in production", () => {
  setupValidProd();
  process.env.XENDIT_SECRET_KEY = "xendit-secret";
  process.env.XENDIT_WEBHOOK_TOKEN = "xendit-webhook";
  process.env.XENDIT_CHECKOUT_SUCCESS_URL = "https://store.example.com/success";
  process.env.XENDIT_CHECKOUT_CANCEL_URL = "https://store.example.com/cancel";
  assert.doesNotThrow(() => validateMedusaProcessEnv());
});

test("validateMedusaProcessEnv: passes when PayPal client ID, secret, and webhook ID all set", () => {
  setupValidProd();
  process.env.PAYPAL_CLIENT_ID = "AZDxjDScFpQ";
  process.env.PAYPAL_CLIENT_SECRET = "EJp8vlxYBq";
  process.env.PAYPAL_WEBHOOK_ID = "5GP028458E2496506";
  process.env.PAYPAL_ENVIRONMENT = "production";
  assert.doesNotThrow(() => validateMedusaProcessEnv());
});

test("validateMedusaProcessEnv: throws when PayPal client ID set but PAYPAL_ENVIRONMENT not production", () => {
  setupValidProd();
  process.env.PAYPAL_CLIENT_ID = "AZDxjDScFpQ";
  process.env.PAYPAL_CLIENT_SECRET = "EJp8vlxYBq";
  process.env.PAYPAL_WEBHOOK_ID = "5GP028458E2496506";
  process.env.PAYPAL_ENVIRONMENT = "sandbox";
  assert.throws(
    () => validateMedusaProcessEnv(),
    /PAYPAL_ENVIRONMENT must be production/,
  );
});

test("validateMedusaProcessEnv: passes when no optional payment providers configured", () => {
  setupValidProd();
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.STRIPE_API_KEY;
  delete process.env.XENDIT_SECRET_KEY;
  delete process.env.XENDIT_WEBHOOK_TOKEN;
  assert.doesNotThrow(() => validateMedusaProcessEnv());
});

test("validateMedusaProcessEnv: throws in production when Resend configured but TRACKING_HMAC_SECRET missing", () => {
  setupValidProd();
  process.env.RESEND_API_KEY = "re_xxx";
  process.env.RESEND_FROM_EMAIL = "noreply@example.com";
  delete process.env.TRACKING_HMAC_SECRET;
  assert.throws(
    () => validateMedusaProcessEnv(),
    /TRACKING_HMAC_SECRET is required in production when Resend is configured/,
  );
});

test("validateMedusaProcessEnv: warns in development when Resend configured but TRACKING_HMAC_SECRET missing", () => {
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgres://x";
  process.env.RESEND_API_KEY = "re_xxx";
  process.env.RESEND_FROM_EMAIL = "noreply@example.com";
  delete process.env.TRACKING_HMAC_SECRET;
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  try {
    validateMedusaProcessEnv();
  } finally {
    console.warn = origWarn;
  }
  const found = warnings.some((w) => w.includes("TRACKING_HMAC_SECRET"));
  assert.ok(found, "should warn about TRACKING_HMAC_SECRET, not TRACKING_LINK_SECRET");
});
