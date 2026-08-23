import assert from "node:assert/strict";
import test from "node:test";
import { ActionRegistry, ViewportController, getDocumentTag, serializeHtml } from "./builder-actions";

test("export removes visual-builder helpers, editor attributes, and extension scripts", () => {
  const result = serializeHtml('<html><body data-uvs-node="1" contenteditable="true"><div uvs-hidden>Hi</div><script src="chrome-extension://x/a.js"></script></body></html>');
  assert.equal(result.includes("data-uvs-node"), false);
  assert.equal(result.includes("contenteditable"), false);
  assert.equal(result.includes("chrome-extension"), false);
  assert.equal(getDocumentTag(result, "body").includes("Hi"), true);
});

test("viewport and declarative action dispatch preserve shared state", () => {
  const viewport = new ViewportController(); assert.equal(viewport.className(), ""); viewport.set("tablet"); assert.equal(viewport.className(), "tablet");
  const actions = new ActionRegistry(); let called = ""; actions.register("save", () => { called = "save"; }); actions.bind({ key: "s", ctrlOrMeta: true }, "save"); actions.dispatchShortcut({ key: "S", ctrlOrMeta: true }); assert.equal(called, "save");
});
