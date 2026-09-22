/**
 * Canonical storefront catalog facade backed by the native Worker API.
 * The facade keeps route imports stable while the runtime migration settles.
 */
export type {
  CategorySummariesResult,
  CommerceFetchFailure,
  ProductBySlugResult,
  ProductsPageResult,
  VariantFacetsResult,
} from "./catalog-worker-fetch";
export {
  fetchCategorySummaries,
  fetchFeaturedProducts,
  fetchProductBySlug,
  fetchProductSlugsForSitemap,
  fetchProductsPage,
  fetchRelatedProducts,
  fetchVariantFacets,
} from "./catalog-worker-fetch";
