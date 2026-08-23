import assert from "node:assert/strict";
import test from "node:test";
import { generateCssVariableProperties } from "./dynamic-properties";

test("dynamic properties create typed sections and source-backed variable controls", () => {
  const properties = generateCssVariableProperties({
    font: { "--bs-font": { value: "Inter", type: "font", friendlyName: "font" } },
    color: { "--bs-primary": { value: "#123", type: "color", friendlyName: "primary" } },
    dimensions: {},
  });
  assert.deepEqual(properties.slice(0, 3).map((property) => property.key), ["cssVarsfont", "cssvar1", "cssVarscolor"]);
  assert.equal(properties[1]?.data.selector, "--bs-font");
  assert.equal(properties[3]?.defaultValue, "#123");
});
