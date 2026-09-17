import assert from "node:assert/strict";
import test from "node:test";
import { Registry, loadPaletteGroups } from "./registry";

test("generic sibling registries preserve insertion and requested palette order", () => {
  const registry = new Registry<{ label: string }>();
  const hero = registry.add("hero", { label: "Hero" });
  const card = registry.add("card", { label: "Card" });
  assert.deepEqual(registry.values(), [hero, card]);
  assert.deepEqual(loadPaletteGroups({ Content: ["card", "missing", "hero"] }, registry), [
    { name: "Content", items: [card, hero] },
  ]);
});

test("registry lookup returns undefined for unknown types", () => {
  assert.equal(new Registry<string>().get("missing"), undefined);
});
