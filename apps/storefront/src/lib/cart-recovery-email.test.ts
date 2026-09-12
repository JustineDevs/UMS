import assert from "node:assert/strict";
import test from "node:test";
import { buildCartRecoveryUrl } from "./cart-recovery-email";

test("cart recovery URL is scoped to an expiring signed cart capability", () => {
  const previous = process.env.TRACKING_HMAC_SECRET;
  process.env.TRACKING_HMAC_SECRET = "test-cart-recovery-secret";
  try {
    const url = buildCartRecoveryUrl("https://store.example.test/", "cart_123");
    assert.ok(url);
    assert.match(url, /^https:\/\/store\.example\.test\/checkout\?token=v3\./);
    assert.equal(url.includes("cart_123"), false);
    assert.equal(buildCartRecoveryUrl("https://store.example.test", ""), null);
  } finally {
    if (previous === undefined) delete process.env.TRACKING_HMAC_SECRET;
    else process.env.TRACKING_HMAC_SECRET = previous;
  }
});
