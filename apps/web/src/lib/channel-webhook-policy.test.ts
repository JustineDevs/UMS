import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gateChannelWebhookSecretConfigured } from "./channel-webhook-policy";

describe("gateChannelWebhookSecretConfigured", () => {
  it("allows empty secret in development", () => {
    const r = gateChannelWebhookSecretConfigured(undefined, undefined, "development");
    assert.equal(r.ok, true);
  });

  it("rejects empty secret on Vercel preview", () => {
    const r = gateChannelWebhookSecretConfigured(
      "",
      "preview",
      "production",
    );
    assert.equal(r.ok, false);
  });

  it("rejects empty secret on Vercel production", () => {
    const r = gateChannelWebhookSecretConfigured(undefined, "production", "production");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
    assert.ok(r.error.length > 0);
  });

  it("rejects empty secret when not Vercel and NODE_ENV is production", () => {
    const r = gateChannelWebhookSecretConfigured("", undefined, "production");
    assert.equal(r.ok, false);
  });

  it("allows production when secret is set", () => {
    const r = gateChannelWebhookSecretConfigured(
      "a".repeat(32),
      "production",
      "production",
    );
    assert.equal(r.ok, true);
  });
});
