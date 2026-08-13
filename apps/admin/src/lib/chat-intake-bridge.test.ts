import assert from "node:assert/strict";
import test from "node:test";

import {
  chatOrderCompletionStatus,
  isAllowedChatOrderTransition,
} from "./chat-intake-bridge";

test("chat order completion only marks captured payments completed", () => {
  assert.equal(chatOrderCompletionStatus("captured"), "completed");
  assert.equal(chatOrderCompletionStatus("partially_captured"), "completed");
  assert.equal(chatOrderCompletionStatus("awaiting"), "pending_payment");
  assert.equal(chatOrderCompletionStatus("not_paid"), "pending_payment");
  assert.equal(chatOrderCompletionStatus(undefined), "pending_payment");
});

test("chat order transitions allow draft completion but keep payment pending explicit", () => {
  assert.equal(isAllowedChatOrderTransition("draft_created", "completed"), true);
  assert.equal(isAllowedChatOrderTransition("pending_payment", "completed"), false);
  assert.equal(isAllowedChatOrderTransition("pending", "completed"), false);
});
