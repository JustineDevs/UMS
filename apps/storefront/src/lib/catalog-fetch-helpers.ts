import type {
  CategorySummariesResult,
  CommerceFetchFailure,
  ProductsPageResult,
  VariantFacetsResult,
} from "./catalog-fetch";

/**
 * Only the primary product list should block the whole shop. Category and facet
 * fetches are sidecars; if they fail while products succeed, callers should
 * degrade (empty sidebar) and optionally show a secondary warning.
 */
export function primaryCommerceFailure(
  page: ProductsPageResult,
): CommerceFetchFailure | null {
  if (page.kind !== "ok") {
    return page;
  }
  return null;
}

export function secondaryCommerceFailure(
  categories: CategorySummariesResult,
  facets: VariantFacetsResult,
): CommerceFetchFailure | null {
  if (categories.kind !== "ok") {
    return categories;
  }
  if (facets.kind !== "ok") {
    return facets;
  }
  return null;
}
