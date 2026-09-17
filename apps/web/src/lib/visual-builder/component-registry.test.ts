import assert from "node:assert/strict";
import test from "node:test";
import { ComponentRegistry } from "./component-registry";

const element = (tagName: string, attributes: Record<string, string>) => ({
  tagName,
  attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
});

test("registry registration builds the source lookup indexes", () => {
  const registry = new ComponentRegistry();
  const button = registry.register("button", {
    name: "Button", nodes: ["button"], attributes: { role: "button" }, classes: ["cta"], classesRegex: ["^btn-"]
  });
  assert.equal(registry.get("button"), button);
  assert.equal(registry.matchNode(element("div", { role: "button" })), button);
  assert.equal(registry.matchNode(element("div", { class: "cta" })), button);
  assert.equal(registry.matchNode(element("div", { class: "btn-primary" })), button);
  assert.equal(registry.matchNode(element("button", {})), button);
});

test("attribute matching has priority over class, regex, and tag matching", () => {
  const registry = new ComponentRegistry();
  const tag = registry.register("tag", { nodes: ["div"] });
  const classMatch = registry.register("class", { classes: ["target"] });
  const attributeMatch = registry.register("attribute", { attributes: ["data-component"] });
  assert.equal(registry.matchNode(element("div", { class: "target", "data-component": "yes" })), attributeMatch);
  assert.notEqual(classMatch, tag);
});
