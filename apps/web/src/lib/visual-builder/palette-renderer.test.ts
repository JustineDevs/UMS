import assert from "node:assert/strict";
import test from "node:test";
import { Registry } from "./registry";
import { paletteGroupsFromRegistry, renderPalette, type PaletteDomElement } from "./palette-renderer";

function factory() {
  const nodes: PaletteDomElement[] = [];
  const dom = {
    createElement: () => {
      const children: PaletteDomElement[] = []; const listeners: ((event: { dataTransfer?: { setData(type: string, value: string): void } }) => void)[] = [];
      const element = {
        className: "", textContent: "", draggable: false, dataset: {},
        append: (...items: PaletteDomElement[]) => children.push(...items),
        addEventListener: (_type: "dragstart", listener: (event: { dataTransfer?: { setData(type: string, value: string): void } }) => void) => listeners.push(listener),
      };
      nodes.push(element); return element;
    },
  };
  return { dom, nodes };
}

test("palette renders grouped draggable entries and writes the visual-builder drag payload", () => {
  const registry = new Registry<{ type: string; name: string }>(); registry.add("html/heading", { type: "html/heading", name: "Heading" });
  const { dom, nodes } = factory(); const root = renderPalette(paletteGroupsFromRegistry({ Base: ["html/heading"] }, registry), dom);
  const entry = nodes.find((node) => node.dataset.component === "html/heading"); assert.equal(root.className, "uvs-palette"); assert.equal(entry?.draggable, true);
});
