import test from "node:test";
import assert from "node:assert/strict";
import {
  cssColorForVariantColorLabel,
  swatchNeedsLightStroke,
} from "./variant-color-swatch";

test("cssColorForVariantColorLabel maps common labels", () => {
  assert.equal(cssColorForVariantColorLabel("White"), "#ffffff");
  assert.equal(cssColorForVariantColorLabel("BLACK"), "#0a0a0a");
  assert.equal(cssColorForVariantColorLabel("  Grey "), "#9ca3af");
});

test("cssColorForVariantColorLabel accepts hex in label", () => {
  assert.equal(cssColorForVariantColorLabel("#ff00aa"), "#ff00aa");
});

test("swatchNeedsLightStroke for white and black", () => {
  assert.equal(swatchNeedsLightStroke("#ffffff"), true);
  assert.equal(swatchNeedsLightStroke("#0a0a0a"), false);
});
