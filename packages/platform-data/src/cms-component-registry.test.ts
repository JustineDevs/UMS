import test from "node:test";
import assert from "node:assert/strict";
import {
  componentInstanceFromBlock,
  getCmsComponentDefinition,
  resolveCmsComponentDefinition,
  resolveCmsInstanceProps,
} from "./cms-component-registry.js";

test("component registry resolves a legacy block as a reusable instance", () => {
  const instance = componentInstanceFromBlock({
    id: "hero-1",
    type: "hero",
    props: { title: "Store launch" },
  });

  assert.equal(instance.componentId, "hero");
  assert.equal(getCmsComponentDefinition(instance.componentId)?.name, "Hero banner");
  assert.equal(resolveCmsInstanceProps(instance).title, "Store launch");
  assert.deepEqual(resolveCmsInstanceProps({ ...instance, variantId: "compact", props: {} }).layout, { minHeight: "220px" });
});

test("variants provide defaults while instance props remain authoritative", () => {
  const definition = getCmsComponentDefinition("cta-row");
  assert.ok(definition);
  const resolved = resolveCmsInstanceProps({
    componentId: "cta-row",
    variantId: "solid",
    props: { label: "Buy now", href: "/shop" },
  });

  assert.equal(resolved.label, "Buy now");
  assert.equal(resolved.href, "/shop");
  assert.equal(definition.slots.length, 0);
  assert.deepEqual(definition.variants.map((variant) => variant.id), ["solid", "outline"]);
});

test("definitions expose builder matching and editor metadata", () => {
  const definition = getCmsComponentDefinition("hero");
  assert.ok(definition);
  assert.deepEqual(definition.match?.tags, ["section"]);
  assert.deepEqual(definition.match?.classes, ["hero"]);
  assert.equal(definition.responsive, true);
  assert.deepEqual(definition.toolbar, ["move", "duplicate", "delete"]);
  assert.equal(definition.props[0]?.section, "content");
});

test("resolves inherited definitions with child overrides", () => {
  const parent = getCmsComponentDefinition("hero");
  assert.ok(parent);
  const child = {
    ...parent,
    id: "hero-child",
    name: "Child hero",
    extendsComponentId: "hero",
    props: [{ key: "title", label: "Child title", type: "text" as const }],
    styleTokens: { accent: "#111827" },
  };
  const resolved = resolveCmsComponentDefinition([parent, child], "hero-child");
  assert.ok(resolved);
  assert.equal(resolved.props.find((item) => item.key === "title")?.label, "Child title");
  assert.equal(resolved.styleTokens.accent, "#111827");
  assert.ok(resolved.slots.some((slot) => slot.name === "actions"));
});
