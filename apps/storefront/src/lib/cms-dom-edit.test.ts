import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCmsDomStyle } from "./cms-dom-edit";

test("normalizes the inspector font-color alias to native CSS color", () => {
  assert.equal(normalizeCmsDomStyle("style.font-color", "#e11d48"), "style.color");
  assert.equal(normalizeCmsDomStyle("style.color", "#e11d48"), "style.color");
  assert.equal(normalizeCmsDomStyle("style.color", "red; background: url(x)"), null);
});
