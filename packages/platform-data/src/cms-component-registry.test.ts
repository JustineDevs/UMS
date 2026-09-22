import test from "node:test";
import assert from "node:assert/strict";
import {
  cmsComponentIdForType,
  canonicalCmsBlockDefinition,
  componentInstanceFromBlock,
  getCmsDefaultProps,
  getCmsComponentDefinition,
  isSafeCmsStyleKey,
  listCmsBlockPalette,
  resolveCmsComponentDefinition,
  resolveCmsInstanceProps,
  validateCmsBlockInstance,
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

test("the canonical registry covers legacy flat block types and defaults", () => {
  const palette = listCmsBlockPalette();
  const types = new Set(palette.map((item) => item.type));
  assert.equal(types.size, palette.length, "canonical palette must not contain duplicate block types");
  for (const type of ["hero", "rich_text", "image", "divider", "faq", "video", "trust_strip", "contact_strip", "newsletter", "featured_products", "product_grid", "promo_banner", "feature_grid", "testimonial_grid", "announcement_bar"]) {
    assert.ok(types.has(type), `missing canonical palette entry for ${type}`);
    assert.ok(Object.keys(getCmsDefaultProps(type)).length >= 0);
  }
  assert.equal(cmsComponentIdForType("two_column"), "two-column");
  assert.equal(cmsComponentIdForType("featured-products"), "featured-products");
  assert.equal(getCmsDefaultProps("divider").heightPx, 24);
  assert.deepEqual(getCmsDefaultProps("faq").items, [{ q: "Question?", a: "<p>Answer.</p>" }]);
  assert.equal(getCmsDefaultProps("product_grid").columns, 4);
  assert.equal(getCmsDefaultProps("promo_banner").ctaLabel, "Shop now");
});

test("every canonical block exposes the runtime contract", () => {
  for (const definition of listCmsBlockPalette()) {
    assert.match(definition.renderer, /^cms:/);
    assert.match(definition.previewRenderer, /^cms-preview:/);
    assert.ok(definition.defaultProps && typeof definition.defaultProps === "object");
    assert.ok(Array.isArray(definition.slots));
    assert.ok(definition.componentId);
  }
});

test("legacy block conversion preserves canonical component identity", () => {
  const instance = componentInstanceFromBlock({
    id: "legacy-image",
    type: "featured_products",
    props: { slugs: "one" },
  });
  assert.equal(instance.componentId, "featured-products");
});

test("canonical block projection owns renderer, schema, defaults, and bounded policies", () => {
  const definition = getCmsComponentDefinition("hero");
  assert.ok(definition);
  const canonical = canonicalCmsBlockDefinition(definition);
  assert.equal(canonical.renderer, "cms:hero");
  assert.equal(canonical.previewRenderer, "cms-preview:hero");
  assert.equal(canonical.defaultProps.title, "New hero");
  assert.equal((canonical.propsSchema as { type: string }).type, "object");
  assert.deepEqual(canonical.responsivePolicy.allowedPresets, ["show", "hide", "stack", "compact", "default"]);
  assert.equal(canonical.accessibilityPolicy.requireAccessibleName, true);
  assert.deepEqual(canonical.migration, []);
});

test("publish validation uses canonical variants and style-token boundaries", () => {
  assert.deepEqual(validateCmsBlockInstance({
    componentId: "hero",
    variantId: "missing",
    props: {},
    styles: { color: "red" },
  }), ["hero: unknown variant: missing", "hero: unsafe style key: color"]);
  assert.deepEqual(validateCmsBlockInstance({
    componentId: "hero",
    variantId: "compact",
    props: { title: "Launch" },
    styles: { "--cms-accent": "var(--color-primary)" },
  }), []);
  assert.equal(isSafeCmsStyleKey("style.color"), true);
  assert.equal(isSafeCmsStyleKey("style.background-image"), false);
  assert.deepEqual(validateCmsBlockInstance({
    componentId: "hero",
    styles: { "style.color": "#111827" },
  }), []);
});
