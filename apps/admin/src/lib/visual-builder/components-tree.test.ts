import assert from "node:assert/strict";
import test from "node:test";
import { drawComponentsTree } from "./components-tree";
import type { ComponentTreeNode, TreeDomElement, TreeDomFactory } from "./components-tree";

class FakeElement implements TreeDomElement {
  className = "";
  textContent = "";
  dataset: Record<string, string> = {};
  style = { backgroundImage: "" };
  treeNode?: unknown;
  children: FakeElement[] = [];
  append(...children: TreeDomElement[]): void { this.children.push(...children as FakeElement[]); }
}

const dom: TreeDomFactory = { createElement: () => new FakeElement() };

test("component tree renderer recursively builds layers and preserves node identity", () => {
  const sourceNode = { id: "source" };
  const tree: ComponentTreeNode[] = [{
    name: "Section", image: "section.svg", title: "Featured-section", node: sourceNode,
    children: [{ name: "Heading", image: "heading.svg", node: "heading-node", children: [] }],
  }];
  const root = drawComponentsTree(tree, dom, "/assets/", 7) as FakeElement;
  const item = root.children[0];
  const nested = item.children[2] as FakeElement;

  assert.equal(root.children.length, 1);
  assert.equal(item.dataset.component, "Section");
  assert.equal(item.treeNode, sourceNode);
  assert.equal(item.children[0]?.style.backgroundImage, "url(/assets/section.svg)");
  assert.equal(nested.children[0]?.dataset.component, "Heading");
  assert.equal(nested.children[0]?.className, "file");
});

test("component tree renderer uses stable explicit IDs and leaf metadata", () => {
  const root = drawComponentsTree([{ id: "hero", name: "Hero", node: "hero-node", children: [] }], dom) as FakeElement;
  const item = root.children[0];
  assert.equal(item.children[1]?.dataset.id, "idhero");
  assert.equal(item.className, "file");
});
