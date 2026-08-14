/* global describe, beforeEach, afterAll, it, expect, jest */

import { validateMedusaProcessEnv } from "../validate-process-env";

const PSP_KEYS = [
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_ENVIRONMENT",
  "XENDIT_SECRET_KEY",
  "XENDIT_WEBHOOK_TOKEN",
  "NANGO_API_KEY",
  "NANGO_PAYMENT_INTEGRATIONS",
] as const;

function clearPspKeys(): void {
  for (const k of PSP_KEYS) delete process.env[k];
}

function setProductionBase(): void {
  clearPspKeys();
  process.env.JWT_SECRET = "prod-jwt-secret-value";
  process.env.COOKIE_SECRET = "prod-cookie-secret-value";
  process.env.STORE_CORS = "https://store.test";
  process.env.ADMIN_CORS = "https://admin.test";
  process.env.AUTH_CORS = "https://auth.test";
}

describe("validateMedusaProcessEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgres://localhost:5432/test",
      NODE_ENV: "development",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("passes with minimal valid env in development", () => {
    expect(() => validateMedusaProcessEnv()).not.toThrow();
  });

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => validateMedusaProcessEnv()).toThrow("DATABASE_URL");
  });

  it("throws when JWT_SECRET is 'supersecret' in production", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    process.env.JWT_SECRET = "supersecret";
    expect(() => validateMedusaProcessEnv()).toThrow("supersecret");
  });

  it("throws when CORS env missing in production", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    delete process.env.STORE_CORS;
    delete process.env.ADMIN_CORS;
    delete process.env.AUTH_CORS;
    expect(() => validateMedusaProcessEnv()).toThrow("CORS");
  });

  it("throws when Stripe key set but webhook secret missing in production", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    process.env.STRIPE_API_KEY = "sk_live_test";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => validateMedusaProcessEnv()).toThrow("STRIPE_WEBHOOK_SECRET");
  });

  it("throws when TRACKING_HMAC_SECRET is missing with Resend configured in production", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "orders@test.com";
    delete process.env.TRACKING_HMAC_SECRET;
    expect(() => validateMedusaProcessEnv()).toThrow("TRACKING_HMAC_SECRET");
  });

  it("throws when PayPal client ID set but PAYPAL_ENVIRONMENT is not production", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    process.env.PAYPAL_CLIENT_ID = "cid";
    process.env.PAYPAL_CLIENT_SECRET = "sec";
    process.env.PAYPAL_WEBHOOK_ID = "wh";
    process.env.PAYPAL_ENVIRONMENT = "sandbox";
    expect(() => validateMedusaProcessEnv()).toThrow("PAYPAL_ENVIRONMENT");
  });

  it("throws when Xendit secret set and webhook token missing in production", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    process.env.XENDIT_SECRET_KEY = "xendit_sk";
    delete process.env.XENDIT_WEBHOOK_TOKEN;
    expect(() => validateMedusaProcessEnv()).toThrow("XENDIT_WEBHOOK_TOKEN");
  });

  it("passes production with baseline env and no PSP keys set", () => {
    process.env.NODE_ENV = "production";
    setProductionBase();
    expect(() => validateMedusaProcessEnv()).not.toThrow();
  });

  it("warns in dev when Resend is configured but TRACKING_HMAC_SECRET missing", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "orders@test.com";
    delete process.env.TRACKING_HMAC_SECRET;
    expect(() => validateMedusaProcessEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("TRACKING_HMAC_SECRET"),
    );
    warnSpy.mockRestore();
  });
});
