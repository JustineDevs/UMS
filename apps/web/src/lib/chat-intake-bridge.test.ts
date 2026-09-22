import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedChatOrderTransition } from "./chat-intake-bridge";

test("chat ticket completion is not an operator transition; verified payment lifecycle owns it", () => {
  assert.equal(isAllowedChatOrderTransition("draft_created", "completed"), false);
  assert.equal(isAllowedChatOrderTransition("pending_payment", "completed"), false);
  assert.equal(isAllowedChatOrderTransition("processing", "completed"), false);
  assert.equal(isAllowedChatOrderTransition("draft_created", "processing"), true);
  assert.equal(isAllowedChatOrderTransition("pending", "cancelled"), true);
});
