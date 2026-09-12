import assert from "node:assert/strict";
import test from "node:test";
import { UVS_CONCRETE_COMPONENTS, registerVisualBuilderConcreteComponents } from "./component-families";

test("concrete family registry covers every source family registration", () => {
  assert.equal(UVS_CONCRETE_COMPONENTS.length, 134);
  assert.equal(new Set(UVS_CONCRETE_COMPONENTS.map((item) => item.type)).size, 134);
  assert.equal(UVS_CONCRETE_COMPONENTS.every((item) => item.sourceFile.includes("internal/admin/Vvveb/public/js/vvvebjs/")), true);
  const registry = registerVisualBuilderConcreteComponents();
  assert.equal(registry.get("html/heading")?.name, "heading");
  assert.equal(registry.get("embeds/youtube")?.name, "youtube");
  assert.equal(registry.get("ecommerce/product")?.name, "product");
});
