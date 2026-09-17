import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogCategoryTree } from "./catalog-category-tree";

test("catalog category tree preserves parent and orphan categories", () => {
  const tree = buildCatalogCategoryTree([
    { id: "cat_guitars", handle: "guitars", category: "Guitars", count: 2, parentId: null },
    { id: "cat_acoustic", handle: "acoustic", category: "Acoustic", count: 1, parentId: "cat_guitars" },
    { id: "cat_other", handle: "other", category: "Other", count: 1, parentId: "cat_missing" },
  ]);
  assert.equal(tree[0]?.children[0]?.handle, "acoustic");
  assert.equal(tree[1]?.handle, "other");
});
