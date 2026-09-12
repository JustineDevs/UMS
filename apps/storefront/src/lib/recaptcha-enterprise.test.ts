import assert from "node:assert/strict";
import test from "node:test";

import {
  isLocalRecaptchaBypassEnabled,
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "./recaptcha-enterprise";

test("reCAPTCHA bypass is limited to explicit non-production auth-disabled mode", async () => {
  const env = process.env as unknown as Record<string, string | undefined>;
  const original = {
    nodeEnv: env.NODE_ENV,
    authDisable: env.AUTH_DISABLE,
    authDisabled: env.AUTH_DISABLED,
    publicAuthDisable: env.NEXT_PUBLIC_AUTH_DISABLE,
    publicAuthDisabled: env.NEXT_PUBLIC_AUTH_DISABLED,
  };
  try {
    env.NODE_ENV = "development";
    env.AUTH_DISABLE = "true";
    delete env.AUTH_DISABLED;
    assert.equal(isLocalRecaptchaBypassEnabled(), true);
    assert.equal(isRecaptchaConfigured(), true);
    assert.equal(
      await verifyRecaptchaAction(new Request("http://localhost"), "local-development-bypass", "review"),
      true,
    );

    env.NODE_ENV = "production";
    assert.equal(isLocalRecaptchaBypassEnabled(), false);

    env.NODE_ENV = "development";
    delete env.AUTH_DISABLE;
    delete env.AUTH_DISABLED;
    env.NEXT_PUBLIC_AUTH_DISABLE = "true";
    assert.equal(isLocalRecaptchaBypassEnabled(), true);
  } finally {
    if (original.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = original.nodeEnv;
    if (original.authDisable === undefined) delete env.AUTH_DISABLE;
    else env.AUTH_DISABLE = original.authDisable;
    if (original.authDisabled === undefined) delete env.AUTH_DISABLED;
    else env.AUTH_DISABLED = original.authDisabled;
    if (original.publicAuthDisable === undefined) delete env.NEXT_PUBLIC_AUTH_DISABLE;
    else env.NEXT_PUBLIC_AUTH_DISABLE = original.publicAuthDisable;
    if (original.publicAuthDisabled === undefined) delete env.NEXT_PUBLIC_AUTH_DISABLED;
    else env.NEXT_PUBLIC_AUTH_DISABLED = original.publicAuthDisabled;
  }
});

test("standard reCAPTCHA v3 keys use siteverify instead of the Enterprise API", async () => {
  const env = process.env as unknown as Record<string, string | undefined>;
  const original = {
    nodeEnv: env.NODE_ENV,
    provider: env.RECAPTCHA_PROVIDER,
    publicProvider: env.NEXT_PUBLIC_RECAPTCHA_PROVIDER,
    secret: env.RECAPTCHA_SECRET_KEY,
    siteKey: env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
    fetch: globalThis.fetch,
  };
  try {
    env.NODE_ENV = "production";
    delete env.RECAPTCHA_PROVIDER;
    env.NEXT_PUBLIC_RECAPTCHA_PROVIDER = "standard";
    env.RECAPTCHA_SECRET_KEY = "standard-secret";
    env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "standard-site-key";
    let requestUrl = "";
    globalThis.fetch = async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ success: true, action: "review", score: 0.9 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    assert.equal(isRecaptchaConfigured(), true);
    assert.equal(await verifyRecaptchaAction(new Request("https://store.example"), "a".repeat(24), "review"), true);
    assert.equal(requestUrl, "https://www.google.com/recaptcha/api/siteverify");
  } finally {
    if (original.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = original.nodeEnv;
    if (original.provider === undefined) delete env.RECAPTCHA_PROVIDER;
    else env.RECAPTCHA_PROVIDER = original.provider;
    if (original.publicProvider === undefined) delete env.NEXT_PUBLIC_RECAPTCHA_PROVIDER;
    else env.NEXT_PUBLIC_RECAPTCHA_PROVIDER = original.publicProvider;
    if (original.secret === undefined) delete env.RECAPTCHA_SECRET_KEY;
    else env.RECAPTCHA_SECRET_KEY = original.secret;
    if (original.siteKey === undefined) delete env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    else env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = original.siteKey;
    globalThis.fetch = original.fetch;
  }
});

test("public provider wins over a stale server-only provider override", () => {
  const env = process.env as unknown as Record<string, string | undefined>;
  const original = {
    provider: env.RECAPTCHA_PROVIDER,
    publicProvider: env.NEXT_PUBLIC_RECAPTCHA_PROVIDER,
    secret: env.RECAPTCHA_SECRET_KEY,
    siteKey: env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
  };
  try {
    env.RECAPTCHA_PROVIDER = "enterprise";
    env.NEXT_PUBLIC_RECAPTCHA_PROVIDER = "standard";
    env.RECAPTCHA_SECRET_KEY = "standard-secret";
    env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "standard-site-key";
    assert.equal(isRecaptchaConfigured(), true);
  } finally {
    if (original.provider === undefined) delete env.RECAPTCHA_PROVIDER;
    else env.RECAPTCHA_PROVIDER = original.provider;
    if (original.publicProvider === undefined) delete env.NEXT_PUBLIC_RECAPTCHA_PROVIDER;
    else env.NEXT_PUBLIC_RECAPTCHA_PROVIDER = original.publicProvider;
    if (original.secret === undefined) delete env.RECAPTCHA_SECRET_KEY;
    else env.RECAPTCHA_SECRET_KEY = original.secret;
    if (original.siteKey === undefined) delete env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    else env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = original.siteKey;
  }
});
