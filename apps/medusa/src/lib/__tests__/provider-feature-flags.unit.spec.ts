/* global describe, afterEach, beforeEach, it, expect */

import { isProviderEnabled, getDisabledProviders } from "../provider-feature-flags.mts";

describe("provider-feature-flags", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    delete process.env.FEATURE_FLAG_STRIPE;
    delete process.env.FEATURE_FLAG_PAYPAL;
    delete process.env.FEATURE_FLAG_XENDIT;
  });

  it("returns true when flag is unset (default enabled)", () => {
    expect(isProviderEnabled("stripe")).toBe(true);
    expect(isProviderEnabled("paypal")).toBe(true);
  });

  it("returns true when flag is set to '1'", () => {
    process.env.FEATURE_FLAG_STRIPE = "1";
    expect(isProviderEnabled("stripe")).toBe(true);
  });

  it("returns false when flag is set to '0'", () => {
    process.env.FEATURE_FLAG_STRIPE = "0";
    expect(isProviderEnabled("stripe")).toBe(false);
  });

  it("returns false when flag is set to 'false'", () => {
    process.env.FEATURE_FLAG_PAYPAL = "false";
    expect(isProviderEnabled("paypal")).toBe(false);
  });

  it("getDisabledProviders returns providers set to off", () => {
    process.env.FEATURE_FLAG_STRIPE = "0";
    process.env.FEATURE_FLAG_XENDIT = "false";
    const disabled = getDisabledProviders();
    expect(disabled).toContain("stripe");
    expect(disabled).toContain("xendit");
    expect(disabled).not.toContain("paypal");
  });

  it("returns true for unknown providers", () => {
    expect(isProviderEnabled("unknown")).toBe(true);
  });
});
