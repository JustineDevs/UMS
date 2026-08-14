import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { generateTrackingToken, verifyTrackingToken } from "./tracking-token.js";

const secret = "test-secret-32chars-long-enough";

describe("tracking token", () => {
  let orig: string | undefined;

  beforeEach(() => {
    orig = process.env.TRACKING_HMAC_SECRET;
    process.env.TRACKING_HMAC_SECRET = secret;
  });

  afterEach(() => {
    if (orig !== undefined) process.env.TRACKING_HMAC_SECRET = orig;
    else delete process.env.TRACKING_HMAC_SECRET;
  });

  it("creates and verifies valid token", () => {
    const orderId = "order_01HXYZ123";
    const token = generateTrackingToken(orderId);
    assert.ok(token !== null);
    assert.match(token!, /^[A-Za-z0-9_-]+$/);
    assert.strictEqual(verifyTrackingToken(orderId, token!), true);
  });

  it("rejects wrong order ID", () => {
    const orderId = "order_01HXYZ123";
    const token = generateTrackingToken(orderId);
    assert.ok(token !== null);
    assert.strictEqual(
      verifyTrackingToken("order_01HXYZ124", token!),
      false,
    );
  });

  it("rejects wrong token", () => {
    const orderId = "order_01HXYZ123";
    assert.strictEqual(
      verifyTrackingToken(orderId, "wrong-token"),
      false,
    );
  });

  it("rejects empty token", () => {
    assert.strictEqual(
      verifyTrackingToken("order_01HXYZ123", ""),
      false,
    );
  });

  it("produces stable token for same input", () => {
    const orderId = "order_01HXYZ123";
    const a = generateTrackingToken(orderId);
    const b = generateTrackingToken(orderId);
    assert.strictEqual(a, b);
  });

  it("returns null when secret unset", () => {
    delete process.env.TRACKING_HMAC_SECRET;
    assert.strictEqual(generateTrackingToken("order_01HXYZ123"), null);
  });
});
