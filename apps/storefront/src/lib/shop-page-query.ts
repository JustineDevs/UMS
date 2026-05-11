import {
  productListQuerySchema,
  SHOP_PRODUCT_PAGE_SIZE,
  type ProductListQuery,
} from "@apparel-commerce/validation";

export type ShopPageSearchParams = {
  category?: string;
  locale?: string;
  size?: string;
  color?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  offset?: string;
  q?: string;
};

function buildCandidate(searchParams: ShopPageSearchParams) {
  return {
    limit: SHOP_PRODUCT_PAGE_SIZE,
    offset: searchParams.offset,
    category: searchParams.category,
    size: searchParams.size,
    color: searchParams.color,
    brand: searchParams.brand,
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
    q: searchParams.q,
    sort: searchParams.sort,
  };
}

function parseDefaultQuery(): ProductListQuery {
  return productListQuerySchema.parse({
    limit: SHOP_PRODUCT_PAGE_SIZE,
    offset: 0,
    sort: "newest",
  });
}

export function parseShopPageQuery(
  searchParams: ShopPageSearchParams,
): ProductListQuery {
  const candidate = buildCandidate(searchParams);
  const parsed = productListQuerySchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  const invalidPaths = new Set(
    parsed.error.issues.map((issue) => String(issue.path[0] ?? "")),
  );
  const onlyInvalidPrices =
    invalidPaths.size > 0 &&
    [...invalidPaths].every((path) => path === "minPrice" || path === "maxPrice");

  if (onlyInvalidPrices) {
    const retry = productListQuerySchema.safeParse({
      ...candidate,
      minPrice: undefined,
      maxPrice: undefined,
    });
    if (retry.success) {
      return retry.data;
    }
  }

  return parseDefaultQuery();
}
