import assert from "node:assert/strict";
import test from "node:test";
import { loadBreadcrumb } from "./breadcrumb";
import type { BreadcrumbElement } from "./breadcrumb";

function node(parentElement: BreadcrumbElement | null = null): BreadcrumbElement { return { parentElement }; }

test("breadcrumb builds root-to-selected order and excludes the topmost parent", () => {
  const root = node();
  const section = node(root);
  const title = node(section);
  const items = loadBreadcrumb(title, (element) => element === section ? ["Section", "SECTION"] : ["Heading", "H2"]);

  assert.deepEqual(items.map(({ name, className }) => ({ name, className })), [
    { name: "section Section", className: "el-section" },
    { name: "h2 Heading", className: "el-h2" },
  ]);
  assert.equal(items[1]?.element, title);
});

test("breadcrumb handles an absent selected element", () => {
  assert.deepEqual(loadBreadcrumb(null, () => ["unused", "div"]), []);
});
