import assert from "node:assert/strict";
import test from "node:test";
import { LiveCanvasEditor } from "./live-canvas-editor";

function element(tagName: string): HTMLElement {
  const listeners = new Map<string, (event: Event) => void>();
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    dataset: { cmsId: "hero::title" } as DOMStringMap,
    style: {},
    parentElement: null,
    children: { length: 0, item: () => null },
    querySelectorAll: () => [],
    closest: () => node,
    append: () => undefined,
    remove: () => undefined,
    getBoundingClientRect: () => ({ left: 2, top: 3, width: 4, height: 5 } as DOMRect),
    addEventListener: (type: string, listener: (event: Event) => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    get listeners() { return listeners; },
  } as unknown as HTMLElement & { listeners: Map<string, (event: Event) => void> };
  return node;
}

test("live canvas attaches to the iframe document and routes DOM selection", () => {
  const body = element("body") as HTMLElement & { listeners: Map<string, (event: Event) => void> };
  const document = {
    body,
    querySelectorAll: () => [],
    addEventListener: (type: string, listener: (event: Event) => void) => body.listeners.set(type, listener),
    removeEventListener: (type: string) => body.listeners.delete(type),
    createElement: () => element("div"),
  } as unknown as Document;
  let selectedId = "";
  const editor = new LiveCanvasEditor(document, { onSelection: (selection) => { selectedId = selection?.id ?? ""; } });
  editor.attach();
  const selected = editor.select(body);
  assert.equal(selected?.id, "hero::title");
  assert.equal(selectedId, "hero::title");
  editor.detach();
  assert.equal(body.listeners.size, 0);
});

test("live canvas routes visual-builder drag payloads to the real DOM slot", () => {
  const body = element("body") as HTMLElement & { listeners: Map<string, (event: Event) => void> };
  const document = {
    body,
    querySelectorAll: () => [],
    addEventListener: (type: string, listener: (event: Event) => void) => body.listeners.set(type, listener),
    removeEventListener: (type: string) => body.listeners.delete(type),
    createElement: () => element("div"),
  } as unknown as Document;
  let drop: string | null = null;
  const editor = new LiveCanvasEditor(document, { onDrop: (_parent, index, componentId) => { drop = `${componentId}:${index}`; } });
  editor.attach();
  body.listeners.get("drop")?.({
    target: body,
    preventDefault: () => undefined,
    dataTransfer: { types: ["application/x-uvs-component"], getData: () => "html/heading" },
  } as unknown as DragEvent);
  assert.equal(drop, "html/heading:0");
  editor.detach();
});
