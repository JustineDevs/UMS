import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedTransition } from "./admin-workflow";

test("allows draft to pending_review", () => {
  assert.equal(isAllowedTransition("draft", "pending_review"), true);
});

test("rejects draft to approved without intermediate", () => {
  assert.equal(isAllowedTransition("draft", "approved"), false);
});

test("allows failed to draft (retry)", () => {
  assert.equal(isAllowedTransition("failed", "draft"), true);
});
