import test from "node:test";
import assert from "node:assert/strict";
import { isPrivacyErasureConfirmation } from "./account-privacy";

test("account erasure requires the exact confirmation word", () => {
  assert.equal(isPrivacyErasureConfirmation({ confirmation: "DELETE" }), true);
  assert.equal(isPrivacyErasureConfirmation({ confirmation: "delete" }), false);
  assert.equal(isPrivacyErasureConfirmation(null), false);
});
