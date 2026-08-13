import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { capturePostHogEvent } from "./posthog.js";

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
  "POSTHOG_API_KEY",
  "POSTHOG_PROJECT_TOKEN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
  "POSTHOG_HOST",
];

describe("capturePostHogEvent", () => {
  beforeEach(() => backupEnv(ENV_KEYS));
  afterEach(() => restoreEnv(ENV_KEYS));

  it("no-ops without a configured key", async () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      called = true;
      return new Response(null, { status: 204 });
    };
    await capturePostHogEvent({ event: "test", distinctId: "anon" });
    assert.equal(called, false);
    globalThis.fetch = originalFetch;
  });

  it("posts capture payload when configured", async () => {
    delete process.env.POSTHOG_API_KEY;
    process.env.POSTHOG_PROJECT_TOKEN = "phc_123";
    process.env.POSTHOG_HOST = "https://app.posthog.com/";
    let body: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      body = typeof init?.body === "string" ? init.body : null;
      return new Response(null, { status: 200 });
    };
    await capturePostHogEvent({
      event: "checkout_test",
      distinctId: "cart_1",
      properties: { ok: true },
    });
    assert.ok(body);
    const parsed = JSON.parse(body ?? "{}") as {
      api_key: string;
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };
    assert.equal(parsed.api_key, "phc_123");
    assert.equal(parsed.event, "checkout_test");
    assert.equal(parsed.distinct_id, "cart_1");
    assert.equal(parsed.properties.ok, true);
    globalThis.fetch = originalFetch;
  });
});
