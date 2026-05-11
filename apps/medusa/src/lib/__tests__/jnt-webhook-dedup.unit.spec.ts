/* global describe, it, expect */
import { buildJntWebhookDedupId } from "../jnt-webhook-dedup";

describe("J&T webhook dedup ID generation", () => {
  it("builds a dedup ID from orderId, status, and payload identity", () => {
    expect(buildJntWebhookDedupId("order_abc", "SIGNED", "hash123")).toBe(
      "jnt:order_abc:SIGNED:hash123",
    );
  });

  it("uses fallbacks when status or payload identity are undefined", () => {
    expect(buildJntWebhookDedupId("order_xyz", undefined, undefined)).toBe(
      "jnt:order_xyz:unknown:nohash",
    );
  });

  it("handles empty orderId", () => {
    expect(buildJntWebhookDedupId("", "DELIVERING", "hash999")).toBe(
      "jnt::DELIVERING:hash999",
    );
  });
});
