import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCatalogFacetValue } from "./catalog-facet-quality";

test("facet values are trimmed and normalized", () => {
  assert.equal(normalizeCatalogFacetValue("  Rose   Wood "), "Rose Wood");
});

test("facet values reject placeholders and oversized metadata", () => {
  assert.equal(normalizeCatalogFacetValue("unknown"), null);
  assert.equal(normalizeCatalogFacetValue("x".repeat(81)), null);
  assert.equal(normalizeCatalogFacetValue(42), null);
});

test("facet quality metrics expose missing metadata without product data", () => {
  const metrics = { rawProducts: 100, mappedProducts: 96, facetValuesSeen: 672, invalidFacetValues: 48 };
  assert.equal(metrics.mappedProducts / metrics.rawProducts, 0.96);
  assert.equal(metrics.invalidFacetValues / metrics.facetValuesSeen, 48 / 672);
});
