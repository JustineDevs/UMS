import {
  productListQuerySchema,
  SHOP_PRODUCT_PAGE_SIZE,
  type ProductListQuery,
} from "@universal-music-store/validation";

export type ShopPageSearchParams = {
  category?: string;
  locale?: string;
  type?: string;
  finish?: string;
  brand?: string;
  pickupConfig?: string;
  bodyWood?: string;
  condition?: string;
  skillLevel?: string;
  shippingSpeed?: string;
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
    type: searchParams.type,
    finish: searchParams.finish,
    brand: searchParams.brand,
    pickupConfig: searchParams.pickupConfig,
    bodyWood: searchParams.bodyWood,
    condition: searchParams.condition,
    skillLevel: searchParams.skillLevel,
    shippingSpeed: searchParams.shippingSpeed,
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

export type ShopPageQueryDiagnostics = {
  query: ProductListQuery;
  invalidKeys: string[];
};

export function parseShopPageQueryDiagnostics(
  searchParams: ShopPageSearchParams,
): ShopPageQueryDiagnostics {
  const candidate = buildCandidate(searchParams);
  const parsed = productListQuerySchema.safeParse(candidate);
  if (parsed.success) return { query: parsed.data, invalidKeys: [] };

  const invalidPaths = new Set(
    parsed.error.issues.map((issue) => String(issue.path[0] ?? "")),
  );
  const sanitizedCandidate = Object.fromEntries(
    Object.entries(candidate).map(([key, value]) => [
      key,
      invalidPaths.has(key) ? undefined : value,
    ]),
  ) as Record<string, unknown>;
  sanitizedCandidate.limit = SHOP_PRODUCT_PAGE_SIZE;
  if (invalidPaths.has("offset") || sanitizedCandidate.offset === undefined) {
    sanitizedCandidate.offset = 0;
  }
  if (invalidPaths.has("sort") || sanitizedCandidate.sort === undefined) {
    sanitizedCandidate.sort = "newest";
  }
  const sanitized = productListQuerySchema.safeParse(sanitizedCandidate);
  if (sanitized.success) {
    return { query: sanitized.data, invalidKeys: [...invalidPaths] };
  }

  return { query: parseDefaultQuery(), invalidKeys: [...invalidPaths] };
}

export function parseShopPageQuery(
  searchParams: ShopPageSearchParams,
): ProductListQuery {
  return parseShopPageQueryDiagnostics(searchParams).query;
}

export function shopPageShouldNoIndex(query: ProductListQuery): boolean {
  return Boolean(
    query.q ||
      query.type ||
      query.finish ||
      query.brand ||
      query.pickupConfig ||
      query.bodyWood ||
      query.condition ||
      query.skillLevel ||
      query.shippingSpeed ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      (query.offset ?? 0) > 0 ||
      (query.sort ?? "newest") !== "newest",
  );
}
