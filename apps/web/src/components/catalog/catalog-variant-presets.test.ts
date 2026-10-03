import test from "node:test";
import assert from "node:assert/strict";
import {
  exceedsCatalogVariantLimit,
  MAX_CATALOG_VARIANTS,
} from "./catalog-variant-presets";

test("caps catalog variant matrices at the documented maximum", () => {
  assert.equal(MAX_CATALOG_VARIANTS, 80);
  assert.equal(exceedsCatalogVariantLimit(16, 5), false);
  assert.equal(exceedsCatalogVariantLimit(16, 6), true);
  assert.equal(exceedsCatalogVariantLimit(5, 16), false);
  assert.equal(exceedsCatalogVariantLimit(6, 16), true);
  assert.equal(exceedsCatalogVariantLimit(0, 18), false);
});
