import assert from "node:assert/strict";
import test from "node:test";
import { ColorPaletteStore, ContentManager, FontAssetRegistry, UndoStack } from "./content-undo-assets";
import type { ContentElement, NodeContainer, NodeRef } from "./content-undo-assets";

class FakeElement implements ContentElement { innerHTML = ""; outerHTML = "<p></p>"; textContent = ""; attrs = new Map<string, string>(); getAttribute(n: string) { return this.attrs.get(n) ?? null; } setAttribute(n: string, v: string) { this.attrs.set(n, v); } removeAttribute(n: string) { this.attrs.delete(n); } }
class Parent implements NodeContainer { children: NodeRef[] = []; append(n: NodeRef) { n.parentNode = this; this.children.push(n); } insertBefore(n: NodeRef, s: NodeRef) { n.parentNode = this; this.children.splice(this.children.indexOf(s), 0, n); } removeChild(n: NodeRef) { this.children.splice(this.children.indexOf(n), 1); n.parentNode = null; } }
const node = (): NodeRef => ({ parentNode: null });

test("content accessors and mutation undo/redo preserve source behavior", () => {
  const element = new FakeElement();
  ContentManager.setAttr(element, "title", "Hello");
  assert.equal(ContentManager.getAttr(element, "title"), "Hello");
  ContentManager.setHtml(element, "new");
  assert.equal(ContentManager.getHtml(element), "new");
  const stack = new UndoStack();
  stack.add({ type: "characterData", target: element, oldValue: "old", newValue: "new" });
  stack.undo(); assert.equal(element.innerHTML, "old");
  stack.redo(); assert.equal(element.innerHTML, "new");
});

test("undo stack truncates redo history when a new mutation is added", () => {
  const element = new FakeElement(); const stack = new UndoStack();
  stack.add({ type: "characterData", target: element, oldValue: "", newValue: "a" }); stack.undo();
  stack.add({ type: "characterData", target: element, oldValue: "", newValue: "b" }); stack.redo();
  assert.equal(element.innerHTML, "");
});

test("font registry cleans provider assets and palette store is copy-safe", () => {
  const calls: string[] = []; const fonts = new FontAssetRegistry();
  fonts.register("google", { addFont: (font) => calls.push(`add:${font}`), removeFont: (font) => calls.push(`remove:${font}`) });
  const element = new FakeElement(); fonts.add("google", "Inter", element); fonts.clean(() => false);
  assert.deepEqual(calls, ["add:Inter", "remove:Inter"]);
  const palette = new ColorPaletteStore(); palette.add("primary", "#123"); const copy = palette.getAll(); palette.remove("primary");
  assert.equal(copy.get("primary"), "#123"); assert.equal(palette.getAll().has("primary"), false);
});

test("child-list mutations restore inserted nodes", () => {
  const parent = new Parent(); const child = node(); parent.append(child); const stack = new UndoStack();
  stack.add({ type: "childList", target: parent, addedNodes: [child], removedNodes: [] }); stack.undo(); assert.equal(parent.children.length, 0); stack.redo(); assert.equal(parent.children.length, 1);
});
