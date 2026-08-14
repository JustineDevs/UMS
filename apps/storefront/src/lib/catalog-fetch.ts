/**
 * Storefront catalog: re-exports Medusa Store API fetchers from `catalog-medusa-fetch.ts`.
 * @see catalog-medusa-fetch.ts for implementation.
 */
export type {
  
  CategorySummariesResult,
  
  CommerceFetchFailure,
  
  ProductBySlugResult,
  ProductsPageResult,
  
  VariantFacetsResult,
} from "./catalog-medusa-fetch";
export {
  
  fetchCategorySummaries,
  fetchFeaturedProducts,
  fetchProductBySlug,
  fetchProductSlugsForSitemap,
  fetchProductsPage,
  fetchRelatedProducts,
  fetchVariantFacets,
} from "./catalog-medusa-fetch";
