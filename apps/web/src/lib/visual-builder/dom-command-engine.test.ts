import assert from "node:assert/strict";
import test from "node:test";
import { DomEditorSession } from "./dom-command-engine";

function fakeElement(tagName: string, text = ""): HTMLElement {
  const attrs = new Map<string, string>();
  const children: HTMLElement[] = [];
  const element = {
    tagName: tagName.toUpperCase(), dataset: {} as DOMStringMap, style: { getPropertyValue: () => "", setProperty: () => undefined },
    children: { get length() { return children.length; }, item: (index: number) => children[index] ?? null },
    parentElement: null as HTMLElement | null, innerHTML: text, textContent: text,
    getBoundingClientRect: () => ({ left: 1, top: 2, width: 3, height: 4 } as DOMRect),
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => attrs.set(name, value), removeAttribute: (name: string) => attrs.delete(name),
    append: (...nodes: HTMLElement[]) => nodes.forEach((node) => { node.parentElement?.removeChild(node); (node as unknown as { parentElement: HTMLElement | null }).parentElement = element as HTMLElement; children.push(node); }),
    insertBefore: (node: HTMLElement, sibling: HTMLElement | null) => { node.parentElement?.removeChild(node); (node as unknown as { parentElement: HTMLElement | null }).parentElement = element as HTMLElement; const at = sibling ? children.indexOf(sibling) : children.length; children.splice(at < 0 ? children.length : at, 0, node); },
    removeChild: (node: HTMLElement) => { const index = children.indexOf(node); if (index >= 0) children.splice(index, 1); (node as unknown as { parentElement: HTMLElement | null }).parentElement = null; },
    remove: () => { element.parentElement?.removeChild(element as HTMLElement); }, cloneNode: () => fakeElement(tagName, text), querySelectorAll: () => [],
  } as unknown as HTMLElement;
  return element;
}

test("real DOM command session applies, reorders, clones, and restores mutations", () => {
  const body = fakeElement("body");
  const root = { body, createElement: (tag: string) => fakeElement(tag) } as unknown as Document;
  const session = new DomEditorSession(root);
  const first = fakeElement("p", "before"); const second = fakeElement("p", "second"); body.append(first, second);
  session.select(first);
  session.applyProperty({ key: "innerText", label: "Text", htmlAttr: "innerText" }, "after");
  assert.equal(first.textContent, "after"); assert.equal(session.history.undo(), true); assert.equal(first.textContent, "before");
  session.history.redo(); assert.equal(first.textContent, "after");
  const editableChildren = () => Array.from({ length: body.children.length }, (_, index) => body.children.item(index) as HTMLElement | null).filter((node) => node && node.dataset.uvsOverlay !== "true");
  session.history.clear(); session.move(first, body, 1); assert.equal(editableChildren()[1], first); session.history.undo(); assert.equal(editableChildren()[0], first);
  const clone = session.clone(first); assert.notEqual(clone, first); assert.equal(editableChildren().length, 3); session.history.undo(); assert.equal(editableChildren().length, 2);
});
