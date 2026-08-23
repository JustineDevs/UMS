import assert from "node:assert/strict";
import test from "node:test";
import { getAllCSSVariableNames } from "./color-palette";
import type { CssStyleSheetLike } from "./color-palette";

function sheet(properties: Record<string, string>, selectorText = ":root"): CssStyleSheetLike {
  const names = Object.keys(properties);
  return {
    cssRules: [{ selectorText, style: {
      length: names.length,
      ...Object.fromEntries(names.map((name, index) => [index, name])),
      getPropertyValue: (name: string) => properties[name] ?? "",
    } }],
  };
}

test("CSS variable introspection classifies supported values and excludes derived values", () => {
  const palette = getAllCSSVariableNames([sheet({
    "--bs-primary": "#123456",
    "--bs-font-sans": '"Instrument Sans"',
    "--bs-spacing": "1.5rem",
    "--bs-primary-rgb": "18, 52, 86",
    "--bs-derived": "var(--bs-primary)",
    "--not-a-palette-value": "inherit",
  })]);

  assert.deepEqual(palette.color["--bs-primary"], { value: "#123456", type: "color", friendlyName: "primary" });
  assert.equal(palette.font["--bs-font-sans"]?.friendlyName, "font sans");
  assert.equal(palette.dimensions["--bs-spacing"]?.value, "1.5rem");
  assert.equal(palette.color["--bs-primary-rgb"], undefined);
  assert.equal(palette.color["--bs-derived"], undefined);
  assert.equal(palette.dimensions["--not-a-palette-value"], undefined);
});

test("CSS variable introspection can restrict results to a selector", () => {
  const palette = getAllCSSVariableNames([
    sheet({ "--bs-root": "#000" }, ":root"),
    sheet({ "--bs-button": "#fff" }, ".button"),
  ], ".button");

  assert.equal(palette.color["--bs-button"]?.value, "#fff");
  assert.equal(palette.color["--bs-root"], undefined);
});
