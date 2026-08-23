import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import {
  generateTrackingCapability,
  generateOpaqueTrackingCapability,
  resolveOpaqueTrackingCapability,
  resolveOpaqueTrackingCapabilityDetails,
  buildTrackingUrl,
  buildOrderConfirmationUrl,
  generateTrackingToken,
  verifyTrackingCapability,
  verifyTrackingToken,
} from "./tracking-token.js";

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

  it("expires capabilities and scopes them to one order", () => {
    const now = 1_700_000_000_000;
    const token = generateTrackingCapability("order_01HXYZ123", now, 60_000);
    assert.ok(token);
    assert.strictEqual(
      verifyTrackingCapability("order_01HXYZ123", token!, now),
      true,
    );
    assert.strictEqual(
      verifyTrackingCapability("order_01HXYZ124", token!, now),
      false,
    );
    assert.strictEqual(
      verifyTrackingCapability("order_01HXYZ123", token!, now + 60_001),
      false,
    );
  });

  it("rejects a capability with a different purpose or audience", () => {
    const token = generateTrackingCapability("order_purpose", 1_700_000_000_000, 60_000);
    assert.ok(token);
    assert.equal(
      verifyTrackingCapability("order_purpose", token!.replace(".track.public-tracking.", ".admin.public-tracking."), 1_700_000_000_000),
      false,
    );
    assert.equal(
      verifyTrackingCapability("order_purpose", token!.replace(".track.public-tracking.", ".track.admin."), 1_700_000_000_000),
      false,
    );
  });

  it("accepts a previous key version during secret rotation", () => {
    const oldVersion = process.env.TRACKING_HMAC_KEY_VERSION;
    const oldPreviousVersion = process.env.TRACKING_HMAC_PREVIOUS_KEY_VERSION;
    const oldPreviousSecret = process.env.TRACKING_HMAC_SECRET_PREVIOUS;
    try {
      process.env.TRACKING_HMAC_KEY_VERSION = "v1";
      delete process.env.TRACKING_HMAC_PREVIOUS_KEY_VERSION;
      delete process.env.TRACKING_HMAC_SECRET_PREVIOUS;
      const token = generateTrackingCapability("order_rotated", 1_700_000_000_000, 60_000);
      assert.ok(token?.startsWith("v2.1700000000."));
      process.env.TRACKING_HMAC_KEY_VERSION = "v2";
      process.env.TRACKING_HMAC_PREVIOUS_KEY_VERSION = "v1";
      process.env.TRACKING_HMAC_SECRET_PREVIOUS = secret;
      assert.equal(verifyTrackingCapability("order_rotated", token!, 1_700_000_000_000), true);
    } finally {
      if (oldVersion === undefined) delete process.env.TRACKING_HMAC_KEY_VERSION;
      else process.env.TRACKING_HMAC_KEY_VERSION = oldVersion;
      if (oldPreviousVersion === undefined) delete process.env.TRACKING_HMAC_PREVIOUS_KEY_VERSION;
      else process.env.TRACKING_HMAC_PREVIOUS_KEY_VERSION = oldPreviousVersion;
      if (oldPreviousSecret === undefined) delete process.env.TRACKING_HMAC_SECRET_PREVIOUS;
      else process.env.TRACKING_HMAC_SECRET_PREVIOUS = oldPreviousSecret;
    }
  });

  it("continues to verify legacy v1 capabilities during migration", () => {
    const expiresAt = 1_700_000_060;
    const legacy = createLegacyCapability("order_legacy", expiresAt, secret);
    assert.equal(verifyTrackingCapability("order_legacy", legacy, 1_700_000_000_000), true);
  });

  it("issues opaque expiring capabilities without exposing the commerce ID", () => {
    const now = 1_700_000_000_000;
    const token = generateOpaqueTrackingCapability("order_opaque", now, 60_000);
    assert.ok(token);
    assert.equal(token!.includes("order_opaque"), false);
    assert.equal(resolveOpaqueTrackingCapability(token!, now), "order_opaque");
    assert.equal(resolveOpaqueTrackingCapability(token!, now + 60_001), null);
    assert.equal(resolveOpaqueTrackingCapability(`${token}tampered`, now), null);
    const url = buildTrackingUrl("https://shop.example", "order_opaque");
    assert.ok(url?.startsWith("https://shop.example/track/cap_v3."));
    assert.equal(url?.includes("order_opaque"), false);
  });

  it("does not allow tracking capabilities to access confirmation data", () => {
    const now = 1_700_000_000_000;
    const tracking = generateOpaqueTrackingCapability("order_private", now, 60_000);
    const confirmation = generateOpaqueTrackingCapability("order_private", now, 60_000, "confirmation");
    assert.ok(tracking && confirmation);
    assert.equal(resolveOpaqueTrackingCapability(tracking!, now, "confirmation"), null);
    assert.equal(resolveOpaqueTrackingCapability(confirmation!, now, "confirmation"), "order_private");
    const url = buildOrderConfirmationUrl("https://shop.example", "order_private");
    assert.ok(url?.startsWith("https://shop.example/order-confirmation/cap_v3."));
    assert.equal(url?.includes("order_private"), false);
  });

  it("binds opaque capabilities to hashed customer and store scope", () => {
    const now = 1_700_000_000_000;
    const token = generateOpaqueTrackingCapability(
      "order_scoped",
      now,
      60_000,
      "track",
      { customerEmail: "Buyer@Example.com", storeId: "store_a" },
    );
    assert.ok(token);
    const resolved = resolveOpaqueTrackingCapabilityDetails(token!, now);
    assert.equal(resolved?.id, "order_scoped");
    assert.match(resolved?.scope?.customerEmailHash ?? "", /^[a-f0-9]{64}$/);
    assert.equal(resolved?.scope?.storeId, "store_a");
    assert.equal(resolveOpaqueTrackingCapabilityDetails(token!, now, "confirmation"), null);
  });
});

function createLegacyCapability(id: string, expiresAt: number, key: string): string {
  const signature = createHmac("sha256", key)
    .update(`v1:track:${id}:${expiresAt}`)
    .digest("base64url");
  return `v1.${expiresAt}.${signature}`;
}
