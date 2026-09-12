import assert from "node:assert/strict";
import test from "node:test";
import { PRIVACY_DATA_INVENTORY, canSendMarketingEmail, privacyAsset, retentionCutoff } from "./privacy-inventory.js";

test("privacy inventory covers notification and consent data", () => {
  assert.ok(PRIVACY_DATA_INVENTORY.some((asset) => asset.table === "public_delivery_attempts"));
  assert.deepEqual(privacyAsset("marketing_preferences")?.actions, ["export", "delete"]);
  assert.equal(canSendMarketingEmail("unsubscribed"), false);
  assert.equal(canSendMarketingEmail("subscribed"), true);
});

test("retention cutoff is deterministic", () => {
  assert.equal(retentionCutoff(new Date("2026-08-16T00:00:00Z"), 30).toISOString(), "2026-07-17T00:00:00.000Z");
});
