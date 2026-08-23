import assert from "node:assert/strict";
import test from "node:test";
import { applyPropertyChange, renderPaletteGroups, renderPropertyPanel } from "./property-system";
import type { EditableElement } from "./property-system";

function element(): EditableElement {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  return {
    innerHTML: "old", textContent: "text", outerHTML: "<p>old</p>", style: {},
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => { attrs.set(name, value); if (name === "class") value.split(" ").forEach((item) => classes.add(item)); },
    removeAttribute: (name) => { attrs.delete(name); },
    classList: { add: (...names) => names.forEach((name) => classes.add(name)), remove: (...names) => names.forEach((name) => classes.delete(name)) },
  };
}

test("property panel is metadata-driven and groups controls by section", () => {
  const panel = renderPropertyPanel({ name: "Card", properties: [
    { key: "title", label: "Title", htmlAttr: "innerText" },
    { key: "color", label: "Color", section: "style", htmlAttr: "style" },
  ] });
  assert.equal(panel.sections.content.length, 1);
  assert.equal(panel.sections.style.length, 1);
});

test("property dispatcher applies content, styles, and attributes with mutations", () => {
  const target = element();
  assert.deepEqual(applyPropertyChange(target, { key: "title", label: "Title", htmlAttr: "innerHTML" }, "new"), { type: "attributes", attributeName: "innerHTML", oldValue: "old", newValue: "new" });
  assert.equal(target.innerHTML, "new");
  const mutation = applyPropertyChange(target, { key: "color", label: "Color", htmlAttr: "style" }, "red");
  assert.equal(target.style.color, "red");
  assert.equal(mutation.type, "style");
});

test("palette rendering preserves configured group order and omits missing entries", () => {
  const groups = renderPaletteGroups({ Sections: ["hero", "missing"] }, new Map([["hero", { type: "hero", name: "Hero" }]]));
  assert.deepEqual(groups, [{ name: "Sections", items: [{ type: "hero", name: "Hero" }] }]);
});
