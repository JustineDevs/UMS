export type CommerceInvalidationClassification =
  | "editorial_only"
  | "merchandising_only"
  | "sellability_affecting"
  | "checkout_affecting";

export type CommerceInvalidationRevalidationPlan = {
  tags: string[];
  paths: string[];
};

/**
 * Pure plan for Next.js cache revalidation (tags + paths). Used by
 * `POST /api/internal/invalidate-commerce-state` and unit tests (no `next/cache` import).
 */
export function buildCommerceInvalidationRevalidationPlan(input: {
  productHandles: string[];
  collectionHandlesLowercase: string[];
  classification: CommerceInvalidationClassification;
}): CommerceInvalidationRevalidationPlan {
  const tagSet = new Set<string>();
  const pathSet = new Set<string>();

  for (const handle of input.productHandles) {
    tagSet.add(`product:${handle}`);
    pathSet.add(`/shop/${handle}`);
  }

  for (const cat of input.collectionHandlesLowercase) {
    tagSet.add(`collection:${cat}`);
    pathSet.add(`/collections/${cat}`);
  }

  for (const tag of ["catalog:list", "catalog:search", "storefront:home", "collections:index"]) {
    tagSet.add(tag);
  }
  if (input.classification !== "editorial_only") {
    tagSet.add("storefront:home");
    tagSet.add("collections:index");
  }
  for (const path of ["/", "/shop", "/collections", "/search"]) {
    pathSet.add(path);
  }

  return {
    tags: [...tagSet].sort(),
    paths: [...pathSet].sort(),
  };
}
