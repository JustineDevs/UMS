import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyChannelWebhookSignature } from "./channel-webhook-signature";

describe("verifyChannelWebhookSignature", () => {
  const secret = "test_channel_secret_32_chars_min_";

  it("returns true for matching x-channel-signature style hex", () => {
    const body = '{"event_type":"ping"}';
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyChannelWebhookSignature(body, secret, expected), true);
  });

  it("returns false for wrong signature", () => {
    const body = '{"event_type":"ping"}';
    assert.equal(verifyChannelWebhookSignature(body, secret, "deadbeef"), false);
  });

  it("returns false for empty header", () => {
    assert.equal(verifyChannelWebhookSignature("{}", secret, ""), false);
  });
});
