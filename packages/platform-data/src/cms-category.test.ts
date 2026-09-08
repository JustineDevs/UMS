import assert from "node:assert/strict";
import test from "node:test";
import { parseCmsCategoryBlocks } from "./cms-category.js";

test("category blocks without IDs receive deterministic identities", () => {
  const payload = [
    { type: "hero", props: { title: "Launch" } },
    { type: "rich_text", props: { body: "Details" } },
  ];

  const first = parseCmsCategoryBlocks(payload);
  const second = parseCmsCategoryBlocks(payload);

  assert.deepEqual(first, second);
  assert.match(first[0]?.id ?? "", /^blk_[a-z0-9]+$/);
  assert.notEqual(first[0]?.id, first[1]?.id);
});

test("persisted category block IDs remain authoritative", () => {
  const [block] = parseCmsCategoryBlocks([{ id: "stable", type: "hero", props: {} }]);
  assert.equal(block?.id, "stable");
});
