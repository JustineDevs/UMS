import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertPostHogEnvProduction,
  getPostHogApiKey,
  getPostHogHost,
  listMissingPostHogEnv,
} from "./posthog.js";

const envBackup: Record<string, string | undefined> = {};

function backupEnv(keys: string[]) {
  for (const k of keys) {
    envBackup[k] = process.env[k];
  }
}

function restoreEnv(keys: string[]) {
  for (const k of keys) {
    if (envBackup[k] !== undefined) process.env[k] = envBackup[k];
    else delete process.env[k];
  }
}

const ENV_KEYS = [
  "NODE_ENV",
  "POSTHOG_API_KEY",
  "POSTHOG_PROJECT_TOKEN",
  "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "POSTHOG_HOST",
  "NEXT_PUBLIC_POSTHOG_HOST",
];

describe("posthog env", () => {
  beforeEach(() => backupEnv(ENV_KEYS));
  afterEach(() => restoreEnv(ENV_KEYS));

  it("falls back to public keys and default host", () => {
    delete process.env.POSTHOG_API_KEY;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_123";
    delete process.env.POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    assert.equal(getPostHogApiKey(), "phc_123");
    assert.equal(getPostHogHost(), "https://app.posthog.com");
  });

  it("reports missing env when nothing configured", () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    assert.deepStrictEqual(listMissingPostHogEnv(), [
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN (or NEXT_PUBLIC_POSTHOG_KEY / POSTHOG_PROJECT_TOKEN)",
      "POSTHOG_API_KEY",
    ]);
  });

  it("fails production when api key missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.POSTHOG_API_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    process.env.POSTHOG_HOST = "https://app.posthog.com";
    assert.throws(
      () => assertPostHogEnvProduction("admin"),
      /required PostHog env missing/,
    );
  });
});
