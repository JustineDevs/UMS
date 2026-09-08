import assert from "node:assert/strict";
import test from "node:test";
import { parseCmsPagePresetBlocks } from "./cms-page-block-presets.js";

test("page block presets receive deterministic IDs for legacy blocks", () => {
  const payload = [{ type: "hero", props: { title: "Launch" } }];
  assert.deepEqual(parseCmsPagePresetBlocks(payload), parseCmsPagePresetBlocks(payload));
});

test("page block preset IDs remain authoritative", () => {
  const [block] = parseCmsPagePresetBlocks([{ id: "preset_block", type: "hero", props: {} }]);
  assert.equal(block?.id, "preset_block");
});
