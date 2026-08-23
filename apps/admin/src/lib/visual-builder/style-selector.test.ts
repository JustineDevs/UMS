import assert from "node:assert/strict";
import test from "node:test";
import { addSelectorState, getSelectorForElement } from "./style-selector";
import type { SelectorElement } from "./style-selector";

function node(tagName: string, options: Partial<SelectorElement> = {}): SelectorElement {
  return {
    parentElement: null,
    tagName,
    id: "",
    classList: [],
    ...options,
  };
}

test("selector generation matches visual builder's class, id, and ancestor rules", () => {
  const body = node("BODY", { classList: ["clearfix"] });
  const section = node("section", { parentElement: body, classList: ["content", "masonry"] });
  const article = node("article", { parentElement: section, id: "featured" });
  const title = node("h2", { parentElement: article, classList: ["title"] });

  assert.equal(getSelectorForElement(title), "#featured > .title");
});

test("selector generation handles null, tag-only, and custom ignored classes", () => {
  const root = node("main");
  const child = node("p", { parentElement: root, classList: ["editor-only", "copy"] });

  assert.equal(getSelectorForElement(null), "");
  assert.equal(getSelectorForElement(root), "");
  assert.equal(getSelectorForElement(child, new Set(["editor-only"])), ".copy");
});

test("selector state appends only when the source builder has an active state", () => {
  assert.equal(addSelectorState(".card", ""), ".card");
  assert.equal(addSelectorState(".card", "hover"), ".card:hover");
});
