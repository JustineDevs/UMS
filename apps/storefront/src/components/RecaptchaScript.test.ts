import assert from "node:assert/strict";
import test from "node:test";
import { getRecaptchaToken } from "./RecaptchaScript";

test("getRecaptchaToken fails closed when the browser API rejects during ready", async () => {
  const env = process.env;
  const previousWindow = (globalThis as { window?: unknown }).window;
  process.env = { ...env, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "site-key", NEXT_PUBLIC_RECAPTCHA_PROVIDER: "standard" };
  (globalThis as { window?: unknown }).window = {
    location: { hostname: "store.example" },
    setTimeout,
    clearTimeout,
    grecaptcha: { ready: () => { throw new Error("invalid site key"); } },
  };

  try {
    assert.equal(await getRecaptchaToken("review"), null);
  } finally {
    process.env = env;
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});

test("getRecaptchaToken fails closed when the provider is incomplete", async () => {
  const env = process.env;
  const previousWindow = (globalThis as { window?: unknown }).window;
  process.env = { ...env, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "site-key", NEXT_PUBLIC_RECAPTCHA_PROVIDER: "enterprise" };
  (globalThis as { window?: unknown }).window = {
    location: { hostname: "store.example" },
    setTimeout,
    clearTimeout,
    grecaptcha: { enterprise: {} },
  };

  try {
    assert.equal(await getRecaptchaToken("review"), null);
  } finally {
    process.env = env;
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});

test("getRecaptchaToken fails closed when ready never invokes its callback", async () => {
  const env = process.env;
  const previousWindow = (globalThis as { window?: unknown }).window;
  process.env = { ...env, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "site-key", NEXT_PUBLIC_RECAPTCHA_PROVIDER: "standard" };
  (globalThis as { window?: unknown }).window = {
    location: { hostname: "store.example" },
    setTimeout,
    clearTimeout,
    grecaptcha: { ready: () => undefined },
  };

  try {
    const token = await Promise.race([
      getRecaptchaToken("review"),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_100)),
    ]);
    assert.equal(token, null);
  } finally {
    process.env = env;
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});
