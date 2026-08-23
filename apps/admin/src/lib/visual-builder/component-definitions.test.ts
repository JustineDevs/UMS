import assert from "node:assert/strict";
import test from "node:test";
import { UVS_CONCRETE_COMPONENTS } from "./component-families";
import { getVisualComponentDefinition, UVS_CORE_DEFINITIONS } from "./component-definitions";
import { UVS_SOURCE_CAPTURE } from "./source-capture";
import { UVS_ECOMMERCE_CAPTURE } from "./ecommerce-capture";

test("core definitions preserve source markup and property bindings", () => {
  const heading = getVisualComponentDefinition("html/heading"); assert.equal(heading?.markup, "<h1>Heading</h1>"); assert.equal(heading?.properties.find((item) => item.key === "innerHTML")?.htmlAttr, "innerHTML");
  assert.ok(UVS_CORE_DEFINITIONS.every((item) => item.source.includes("internal/admin/Vvveb/public/js/vvvebjs")));
});

test("captured source registrations retain original markup, matching, and property keys", () => {
  for (const source of UVS_SOURCE_CAPTURE) {
    const definition = getVisualComponentDefinition(source.type);
    assert.ok(definition, source.type);
    if (typeof source.html === "string" && source.html.trim().length > 0) assert.equal(definition.markup, source.html, source.type);
    if (source.nodes && source.nodes.length > 0) assert.deepEqual(definition.nodes, source.nodes, source.type);
    if (source.attributes) assert.deepEqual(definition.attributes, source.attributes, source.type);
    const sourceKeys = source.properties.map((property) => typeof property.key === "string" ? property.key : undefined).filter((key): key is string => Boolean(key));
    if (sourceKeys.length > 0) assert.deepEqual(definition.properties.map((property) => property.key), sourceKeys, source.type);
    assert.match(definition.sourceRegistration, new RegExp(source.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), source.type);
  }
});

test("ecommerce definitions preserve the imported source module objects", () => {
  const names: Record<string, string> = {
    "ecommerce/product": "productComponent",
    "ecommerce/products": "productsComponent",
    "ecommerce/productGallery": "productGalleryComponent",
    "ecommerce/categories": "productCategoriesComponent",
    "ecommerce/manufacturers": "manufacturersComponent",
    "ecommerce/cart": "cartComponent",
    "ecommerce/checkout": "checkoutComponent",
    "ecommerce/filters": "filtersComponent",
  };
  for (const [type, exportName] of Object.entries(names)) {
    const source = UVS_ECOMMERCE_CAPTURE[exportName];
    const definition = getVisualComponentDefinition(type);
    assert.ok(definition, type);
    assert.equal(definition.name, source.name, type);
    assert.deepEqual(definition.attributes, source.attributes, type);
    if (source.html?.trim()) assert.equal(definition.markup, source.html.trim(), type);
    const sourceKeys = source.properties.map((property) => property.key).filter((key): key is string => typeof key === "string");
    assert.deepEqual(definition.properties.map((property) => property.key), sourceKeys, type);
    assert.equal(definition.fullUpdate, source.fullUpdate, type);
    assert.equal(definition.userServerTemplate, source.userServerTemplate, type);
  }
});

test("ported lifecycle bodies execute the original provider and server-component behaviors", () => {
  const previousDocument = globalThis.document;
  const children = new Map<string, { src: string; setAttribute(name: string, value: string): void; getAttribute(name: string): string | null }>();
  const iframe = { src: "https://maps.google.com/maps?q=Paris&z=15&t=q", setAttribute(name: string, value: string) { if (name === "src") this.src = value; }, getAttribute(name: string) { return name === "src" ? this.src : null; } };
  children.set("iframe", iframe);
  const map = { dataset: {}, querySelector(selector: string) { return selector === "iframe" ? iframe : null; }, dispatchEvent() { return true; } } as unknown as HTMLElement;
  const groups = [{ dataset: { group: "automatic" }, style: { display: "" }, classList: { add() { groups[0].style.display = "none"; }, remove() { groups[0].style.display = ""; } } }, { dataset: { group: "autocomplete" }, style: { display: "" }, classList: { add() { groups[1].style.display = "none"; }, remove() { groups[1].style.display = ""; } } }];
  globalThis.document = {
    createElement() { return { setAttribute() {}, appendChild() {}, replaceWith() {} }; },
    querySelectorAll(selector: string) { return selector.includes("autocomplete") ? [groups[1]] : groups; },
  } as unknown as Document;
  try {
    const mapDefinition = getVisualComponentDefinition("widgets/googlemaps");
    assert.ok(mapDefinition?.lifecycle);
    mapDefinition.lifecycle.onChange(map, "q", "London");
    assert.match(iframe.src, /q=London/);
    const cartDefinition = getVisualComponentDefinition("ecommerce/cart");
    assert.ok(cartDefinition?.lifecycle);
    cartDefinition.lifecycle.init({ dataset: { vSource: "autocomplete" } } as unknown as HTMLElement);
    assert.equal(groups[0].style.display, "none");
    assert.equal(groups[1].style.display, "");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("every registered component family resolves to an editable definition", () => {
  for (const family of UVS_CONCRETE_COMPONENTS) {
    const definition = getVisualComponentDefinition(family.type);
    assert.ok(definition, family.type);
    assert.ok(definition.markup.length > 0, family.type);
    assert.ok(definition.properties.length > 0 || definition.source.endsWith(":source-module"), family.type);
    assert.equal(definition.sourceParity, "ported", family.type);
    assert.match(definition.source, new RegExp(family.sourceFile.replaceAll("/", "\\/")), family.type);
    assert.match(definition.sourceRegistration, new RegExp(family.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), family.type);
    assert.ok(definition.lifecycle, family.type);
    assert.ok(!definition.markup.includes('class="vvveb-'), `generated fallback markup: ${family.type}`);
  }
});
