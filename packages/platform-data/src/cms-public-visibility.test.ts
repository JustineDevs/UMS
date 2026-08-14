import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCmsPubliclyVisible } from "./cms-public-visibility.js";

describe("isCmsPubliclyVisible", () => {
  it("hides draft", () => {
    assert.equal(isCmsPubliclyVisible("draft", null), false);
  });

  it("shows published", () => {
    assert.equal(isCmsPubliclyVisible("published", null), true);
  });

  it("hides scheduled until time", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    assert.equal(isCmsPubliclyVisible("scheduled", future), false);
  });

  it("shows scheduled after time", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    assert.equal(isCmsPubliclyVisible("scheduled", past), true);
  });
});
