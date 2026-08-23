/**
 * Medusa Store API catalog queries (listing, PDP, facets, categories, sitemap).
 * Imported by `catalog-fetch.ts`, which re-exports the public surface.
 */
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { Product } from "@universal-music-store/types";
import {
  catalogProductFromMedusaRaw,
  medusaProductRawHasSellableVariant,
  minVariantPrice,
  productMatchesBrand,
  productMatchesPriceRange,
  productMatchesVariantFilters,
} from "./medusa-catalog-mapper";
import { createStorefrontMedusaSdk } from "./medusa-sdk";
import {
  countSellableProductsInStoreList,
  MEDUSA_PRODUCT_STOCK_FIELDS,
} from "./medusa-store-sellable-count";
import { getMedusaStoreBaseUrl } from "@universal-music-store/sdk";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
  getMedusaSalesChannelId,
  withSalesChannelId,
} from "./storefront-medusa-env";
import {
  fetchMedusaPages,
} from "./medusa-pagination";
import { normalizeCatalogFacetValue } from "./catalog-facet-quality";
import { logCommerceObservabilityServer } from "./commerce-observability";

export type CatalogQuery = {
  limit?: number;
  offset?: number;
  category?: string;
  type?: string;
  finish?: string;
  brand?: string;
  pickupConfig?: string;
  bodyWood?: string;
  condition?: string;
  skillLevel?: string;
  shippingSpeed?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  sort?: "newest" | "name_asc" | "price_asc" | "price_desc";
  revalidate?: number;
};

export type CommerceFetchFailure =
  | { kind: "misconfigured"; detail: string }
  | { kind: "service_error"; message: string };

export type ProductsPageResult =
  | { kind: "ok"; products: Product[]; total: number }
  | CommerceFetchFailure;

export type ProductBySlugResult =
  | { kind: "ok"; product: Product }
  | CommerceFetchFailure
  | { kind: "not_found" };

export type ProductIdentityBySlugResult =
  | { kind: "ok"; productId: string; variantIds: string[] }
  | CommerceFetchFailure
  | { kind: "not_found" };

export type CategorySummariesResult =
  | {
      kind: "ok";
      summaries: CategorySummary[];
      fetchedAt?: string;
    }
  | CommerceFetchFailure;

export type VariantFacetsResult =
  | {
      kind: "ok";
      facets: {
        types: string[];
        finishes: string[];
        brands: string[];
        pickupConfigs: string[];
        bodyWoods: string[];
        conditions: string[];
        skillLevels: string[];
        shippingSpeeds: string[];
      };
      quality: {
        rawProducts: number;
        mappedProducts: number;
        facetValuesSeen: number;
        invalidFacetValues: number;
      };
    }
  | CommerceFetchFailure;

export type FeaturedProductsResult =
  | { kind: "ok"; products: Product[] }
  | CommerceFetchFailure;

function normalizedCategoryTag(category: string | undefined): string | null {
  const value = category?.trim().toLowerCase();
  return value ? `collection:${value}` : null;
}

function catalogCacheTags(
  options: CatalogQuery,
  extra: string[] = [],
): string[] {
  const tags = new Set<string>(["catalog:list", ...extra]);
  const collectionTag = normalizedCategoryTag(options.category);
  if (collectionTag) tags.add(collectionTag);
  if (options.q?.trim()) tags.add("catalog:search");
  return [...tags];
}

function misconfigured(detail: string): CommerceFetchFailure {
  return { kind: "misconfigured", detail };
}

function catalogEnvCacheFingerprint(): string {
  const raw = [
    "v2",
    getMedusaStoreBaseUrl(),
    getMedusaPublishableKey() ?? "",
    getMedusaRegionId() ?? "",
    getMedusaSalesChannelId() ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

function isLikelyUnreachableMedusaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("networkerror") ||
    m.includes("socket hang up") ||
    m.includes("certificate") ||
    m.includes("ssl") ||
    m.includes("tls")
  );
}

function catalogServiceError(err: unknown): CommerceFetchFailure {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("Invalid URL") ||
    message.toLowerCase().includes("invalid url")
  ) {
    return {
      kind: "misconfigured",
      detail:
        "Store URL is missing or invalid. Set MEDUSA_BACKEND_URL and NEXT_PUBLIC_MEDUSA_URL to your public store address (deployment env on Vercel, or local URL in development).",
    };
  }
  if (isLikelyUnreachableMedusaError(message)) {
    const base = getMedusaStoreBaseUrl();
    const loopback = base.includes("localhost") || base.includes("127.0.0.1");
    return {
      kind: "misconfigured",
      detail: loopback
        ? `Cannot reach ${base} from the website server. Start your local store service, or set MEDUSA_BACKEND_URL / NEXT_PUBLIC_MEDUSA_URL to a reachable HTTPS URL. Hosted sites cannot use localhost.`
        : `Cannot reach ${base} (${message}). Confirm the store is running and allows this site (CORS).`,
    };
  }
  return { kind: "service_error", message };
}

const MEDUSA_LIST_FIELDS =
  "*variants,*variants.calculated_price,*variants.options,*variants.barcode,*categories,*options,+thumbnail,*images,+metadata,+created_at";

// Coalesce concurrent cold-cache requests in one server instance. Next's
// persistent cache still owns freshness; this only prevents a request burst
// from starting the same upstream scan multiple times.
const productPageInFlight = new Map<string, Promise<ProductsPageResult>>();
const categorySummariesInFlight = new Map<string, Promise<CategorySummariesResult>>();
const variantFacetsInFlight = new Map<string, Promise<VariantFacetsResult>>();

type MedusaCategoryRow = {
  id?: string;
  name?: string;
  handle?: string;
  parent_category_id?: string | null;
};

function requireMedusaClientConfig():
  | { ok: true }
  | { ok: false; reason: CommerceFetchFailure } {
  const regionId = getMedusaRegionId();
  const key = getMedusaPublishableKey();
  if (!key?.trim()) {
    return {
      ok: false,
      reason: misconfigured(
        "Missing public store key (NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY or MEDUSA_PUBLISHABLE_API_KEY). Copy from your store admin under Developer → Publishable API keys.",
      ),
    };
  }
  if (!regionId?.trim()) {
    return {
      ok: false,
      reason: misconfigured(
        "Missing sales region id (NEXT_PUBLIC_MEDUSA_REGION_ID or MEDUSA_REGION_ID). Set the region your store uses (for example from your store admin).",
      ),
    };
  }
  return { ok: true };
}

async function listMedusaCategories(
  sdk: ReturnType<typeof createStorefrontMedusaSdk>,
): Promise<MedusaCategoryRow[]> {
  const { pages } = await fetchMedusaPages(100, async (offset) => {
    const result = await sdk.store.category.list({
      limit: 100,
      offset,
      fields: "id,name,handle,parent_category_id",
    } as Parameters<typeof sdk.store.category.list>[0]);
    const rows = (result.product_categories ?? []) as MedusaCategoryRow[];
    return {
      rows,
      total: typeof result.count === "number" ? result.count : undefined,
    };
  });
  return pages.flat();
}

async function resolveMedusaCategoryId(
  sdk: ReturnType<typeof createStorefrontMedusaSdk>,
  categoryName: string | undefined,
): Promise<string | undefined> {
  if (!categoryName?.trim()) return undefined;
  const want = categoryName.trim().toLowerCase();
  const productCategories = await listMedusaCategories(sdk);
  const row = productCategories.find((c) => {
    const name = (c.name ?? "").trim().toLowerCase();
    const handle = (c.handle ?? "").trim().toLowerCase();
    return name === want || handle === want;
  });
  return row?.id;
}

async function fetchMedusaProductsPage(
  limit: number,
  options: CatalogQuery,
  useSalesChannelId = true,
): Promise<ProductsPageResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) {
    return gate.reason;
  }

  try {
    const sdk = createStorefrontMedusaSdk();
    const regionId = getMedusaRegionId()!;
    const categoryId = await resolveMedusaCategoryId(sdk, options.category);
    const offset = options.offset ?? 0;
    const priceSort =
      options.sort === "price_asc" || options.sort === "price_desc";

    async function scanProducts(
      allowSalesChannel: boolean,
    ): Promise<Product[]> {
      const startedAt = Date.now();
      const collected: Product[] = [];
      let rowsScanned = 0;
      const pageSize = 80;
      const salesChannelId =
        allowSalesChannel && useSalesChannelId
          ? getMedusaSalesChannelId()
          : undefined;

      const { pages, requestCount } = await fetchMedusaPages(
        pageSize,
        async (offset) => {
          const listParams: Record<string, unknown> = {
            region_id: regionId,
            limit: pageSize,
            offset,
            fields: MEDUSA_LIST_FIELDS,
            order:
              options.sort === "name_asc"
                ? "title"
                : options.sort === "newest"
                  ? "-created_at"
                  : "-created_at",
          };
          if (categoryId) listParams.category_id = categoryId;
          if (options.q?.trim()) listParams.q = options.q.trim();

          const { products: rawList, count } = await sdk.store.product.list(
            (salesChannelId
              ? withSalesChannelId(listParams)
              : listParams) as Parameters<typeof sdk.store.product.list>[0],
          );
          return { rows: rawList ?? [], total: count };
        },
      );

      for (const rawList of pages) {
        rowsScanned += rawList.length;

        for (const raw of rawList) {
          const p = catalogProductFromMedusaRaw(raw as never);
          if (!p) continue;
          if (
            !productMatchesVariantFilters(p, {
              type: options.type,
              finish: options.finish,
              pickupConfig: options.pickupConfig,
              bodyWood: options.bodyWood,
              condition: options.condition,
              skillLevel: options.skillLevel,
              shippingSpeed: options.shippingSpeed,
            })
          ) {
            continue;
          }
          if (!productMatchesBrand(p, options.brand)) continue;
          if (
            !productMatchesPriceRange(p, options.minPrice, options.maxPrice)
          ) {
            continue;
          }
          collected.push(p);
        }
      }

      logCommerceObservabilityServer("catalog_scan_completed", {
        source: "storefront_catalog",
        requestCount,
        rowsScanned,
        matchedRows: collected.length,
        durationMs: Date.now() - startedAt,
        salesChannelScoped: Boolean(salesChannelId),
      });

      return collected;
    }

    let collected = await scanProducts(true);
    if (!collected.length && useSalesChannelId && getMedusaSalesChannelId()) {
      collected = await scanProducts(false);
    }

    if (priceSort) {
      collected.sort((a, b) => {
        const pa = minVariantPrice(a);
        const pb = minVariantPrice(b);
        return options.sort === "price_asc" ? pa - pb : pb - pa;
      });
    } else if (options.sort === "name_asc") {
      collected.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      collected.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
    }

    return {
      kind: "ok",
      products: collected.slice(offset, offset + limit),
      total: collected.length,
    };
  } catch (e) {
    return catalogServiceError(e);
  }
}

async function fetchMedusaProductBySlug(
  slug: string,
): Promise<ProductBySlugResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) {
    return gate.reason;
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const regionId = getMedusaRegionId()!;
    const baseParams = {
      region_id: regionId,
      handle: slug,
      limit: 1,
      fields: MEDUSA_LIST_FIELDS,
    };
    const salesChannelId = getMedusaSalesChannelId();
    const query = async (useSalesChannelId: boolean) =>
      sdk.store.product.list(
        (useSalesChannelId && salesChannelId
          ? withSalesChannelId({ ...baseParams })
          : baseParams) as Parameters<typeof sdk.store.product.list>[0],
      );

    let { products } = await query(true);
    let raw = products?.[0];
    let product = raw ? catalogProductFromMedusaRaw(raw as never) : null;

    if (!product && salesChannelId) {
      ({ products } = await query(false));
      raw = products?.[0];
      product = raw ? catalogProductFromMedusaRaw(raw as never) : null;
    }

    if (!product) {
      return { kind: "not_found" };
    }
    return { kind: "ok", product };
  } catch (e) {
    return catalogServiceError(e);
  }
}

async function fetchMedusaProductById(
  productId: string,
): Promise<ProductBySlugResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) return gate.reason;
  try {
    const sdk = createStorefrontMedusaSdk();
    const params = {
      region_id: getMedusaRegionId()!,
      id: productId,
      limit: 1,
      fields: MEDUSA_LIST_FIELDS,
    };
    const salesChannelId = getMedusaSalesChannelId();
    const query = (useSalesChannelId: boolean) =>
      sdk.store.product.list(
        (useSalesChannelId && salesChannelId
          ? withSalesChannelId({ ...params })
          : params) as Parameters<typeof sdk.store.product.list>[0],
      );
    let { products } = await query(true);
    let raw = products?.[0];
    let product = raw ? catalogProductFromMedusaRaw(raw as never) : null;
    if (!product && salesChannelId) {
      ({ products } = await query(false));
      raw = products?.[0];
      product = raw ? catalogProductFromMedusaRaw(raw as never) : null;
    }
    return product ? { kind: "ok", product } : { kind: "not_found" };
  } catch (e) {
    return catalogServiceError(e);
  }
}

async function fetchMedusaCategorySummaries(): Promise<CategorySummariesResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) {
    return gate.reason;
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const regionId = getMedusaRegionId()!;
    const rows = await listMedusaCategories(sdk);
    const summaries: CategorySummary[] = [];
    // Keep catalog pressure bounded while avoiding one network round-trip per
    // category. Four concurrent count scans preserve predictable Medusa load.
    for (let offset = 0; offset < rows.length; offset += 4) {
      const batch = await Promise.all(
        rows.slice(offset, offset + 4).map(async (c) => {
          const id = typeof c.id === "string" ? c.id : "";
          const handle = typeof c.handle === "string" ? c.handle.trim() : "";
          const label = (c.name ?? handle ?? id ?? "").trim();
          if (!label || !id || !handle) return null;
          const parentId =
            typeof (c as { parent_category_id?: unknown })
              .parent_category_id === "string"
              ? (c as { parent_category_id: string }).parent_category_id
              : null;
          const count = await countSellableProductsInStoreList(sdk, regionId, {
            categoryId: id,
          });
          return {
            id,
            handle,
            category: label,
            count,
            parentId,
          } satisfies CategorySummary;
        }),
      );
      summaries.push(
        ...batch.filter(
          (summary): summary is CategorySummary => summary !== null,
        ),
      );
    }
    return {
      kind: "ok",
      summaries: summaries.filter((s) => s.count > 0),
    };
  } catch (e) {
    return catalogServiceError(e);
  }
}

async function fetchMedusaVariantFacets(
  category: string | undefined,
): Promise<VariantFacetsResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) {
    return gate.reason;
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const regionId = getMedusaRegionId()!;
    const categoryId = await resolveMedusaCategoryId(sdk, category);
    async function scanFacets(allowSalesChannel: boolean) {
      const types = new Set<string>();
      const finishes = new Set<string>();
      const brands = new Set<string>();
      const pickupConfigs = new Set<string>();
      const bodyWoods = new Set<string>();
      const conditions = new Set<string>();
      const skillLevels = new Set<string>();
      const shippingSpeeds = new Set<string>();
      const facetPageSize = 100;
      const salesChannelId =
        allowSalesChannel && getMedusaSalesChannelId()
          ? getMedusaSalesChannelId()
          : undefined;
      let sawRawRows = false;
      let rawProducts = 0;
      let mappedProducts = 0;
      let facetValuesSeen = 0;
      let invalidFacetValues = 0;
      const addFacetValue = (set: Set<string>, value: unknown) => {
        facetValuesSeen += 1;
        const normalized = normalizeCatalogFacetValue(value);
        if (!normalized) {
          invalidFacetValues += 1;
          return;
        }
        set.add(normalized);
      };
      const { pages } = await fetchMedusaPages(facetPageSize, async (offset) => {
        const params = {
          region_id: regionId,
          ...(categoryId ? { category_id: categoryId } : {}),
          limit: facetPageSize,
          offset,
          fields: MEDUSA_LIST_FIELDS,
        };
        const result = await sdk.store.product.list(
          (salesChannelId ? withSalesChannelId(params) : params) as Parameters<
            typeof sdk.store.product.list
          >[0],
        );
        return {
          rows: result.products ?? [],
          total: result.count,
        };
      });
      for (const products of pages) {
        if (products.length > 0) sawRawRows = true;
        rawProducts += products.length;
        for (const pr of products) {
          const p = catalogProductFromMedusaRaw(pr as never);
          if (!p) continue;
          mappedProducts += 1;
          addFacetValue(brands, p.brand);
          for (const v of p.variants) {
            const values = [
              [types, v.type],
              [finishes, v.finish],
              [pickupConfigs, v.pickupConfig],
              [bodyWoods, v.bodyWood],
              [conditions, v.condition],
              [skillLevels, v.skillLevel],
              [shippingSpeeds, v.shippingSpeed],
            ] as const;
            for (const [set, value] of values) {
              addFacetValue(set, value);
            }
          }
        }
      }
      return {
        types,
        finishes,
        brands,
        pickupConfigs,
        bodyWoods,
        conditions,
        skillLevels,
        shippingSpeeds,
        sawRawRows,
        rawProducts,
        mappedProducts,
        facetValuesSeen,
        invalidFacetValues,
      };
    }

    let primary = await scanFacets(true);
    if (!primary.sawRawRows && getMedusaSalesChannelId()) {
      primary = await scanFacets(false);
    }
    return {
      kind: "ok",
      facets: {
        types: [...primary.types].sort(),
        finishes: [...primary.finishes].sort((a, b) => a.localeCompare(b)),
        brands: [...primary.brands].sort((a, b) => a.localeCompare(b)),
        pickupConfigs: [...primary.pickupConfigs].sort((a, b) =>
          a.localeCompare(b),
        ),
        bodyWoods: [...primary.bodyWoods].sort((a, b) => a.localeCompare(b)),
        conditions: [...primary.conditions].sort((a, b) => a.localeCompare(b)),
        skillLevels: [...primary.skillLevels].sort((a, b) =>
          a.localeCompare(b),
        ),
        shippingSpeeds: [...primary.shippingSpeeds].sort((a, b) =>
          a.localeCompare(b),
        ),
      },
      quality: {
        rawProducts: primary.rawProducts,
        mappedProducts: primary.mappedProducts,
        facetValuesSeen: primary.facetValuesSeen,
        invalidFacetValues: primary.invalidFacetValues,
      },
    };
  } catch (e) {
    return catalogServiceError(e);
  }
}

export async function fetchProductsPage(
  limit: number,
  options: CatalogQuery = {},
): Promise<ProductsPageResult> {
  const normalizedOptions = {
    ...options,
    category: options.category?.trim() || undefined,
    type: options.type?.trim() || undefined,
    finish: options.finish?.trim() || undefined,
    brand: options.brand?.trim() || undefined,
    pickupConfig: options.pickupConfig?.trim() || undefined,
    bodyWood: options.bodyWood?.trim() || undefined,
    condition: options.condition?.trim() || undefined,
    skillLevel: options.skillLevel?.trim() || undefined,
    shippingSpeed: options.shippingSpeed?.trim() || undefined,
    q: options.q?.trim() || undefined,
  };
  const cached = unstable_cache(
    async () => fetchMedusaProductsPage(limit, normalizedOptions),
    [
      "storefront-products-page",
      catalogEnvCacheFingerprint(),
      String(limit),
      JSON.stringify(normalizedOptions),
    ],
    {
      revalidate: normalizedOptions.revalidate ?? 60,
      tags: catalogCacheTags(normalizedOptions),
    },
  );
  const key = JSON.stringify([limit, normalizedOptions]);
  const inFlight = productPageInFlight.get(key);
  if (inFlight) return inFlight;
  const request = cached().finally(() => productPageInFlight.delete(key));
  productPageInFlight.set(key, request);
  return request;
}

export async function fetchFeaturedProducts(
  limit = 4,
): Promise<FeaturedProductsResult> {
  const cached = unstable_cache(
    async () => {
      const primary = await fetchMedusaProductsPage(
        limit,
        { sort: "newest" },
        true,
      );
      if (primary.kind !== "ok") {
        return primary;
      }
      if (primary.products.length > 0 || !getMedusaSalesChannelId()) {
        return primary;
      }
      return fetchMedusaProductsPage(limit, { sort: "newest" }, false);
    },
    [
      "storefront-featured-products",
      catalogEnvCacheFingerprint(),
      String(limit),
    ],
    {
      revalidate: 60,
      tags: ["catalog:list", "storefront:home"],
    },
  );
  const r = await cached();
  if (r.kind !== "ok") {
    return r;
  }
  return { kind: "ok", products: r.products };
}

export async function fetchRelatedProducts(
  current: Product,
  limit = 4,
): Promise<FeaturedProductsResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) {
    return gate.reason;
  }

  const wanted = current.relatedHandles
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, Math.max(limit, 8));
  if (wanted.length > 0) {
    const out: Product[] = [];
    for (const handle of wanted) {
      const r = await fetchMedusaProductBySlug(handle);
      if (r.kind === "ok" && r.product.id !== current.id) {
        out.push(r.product);
      }
      if (out.length >= limit) break;
    }
    if (out.length > 0) {
      return { kind: "ok", products: out.slice(0, limit) };
    }
  }

  if (!current.category?.trim()) {
    return { kind: "ok", products: [] };
  }
  const r = await fetchMedusaProductsPage(limit + 10, {
    category: current.category,
    sort: "newest",
  });
  if (r.kind !== "ok") {
    return r;
  }
  const rest = r.products.filter((p) => p.id !== current.id);
  return { kind: "ok", products: rest.slice(0, limit) };
}

export async function fetchProductBySlug(
  slug: string,
): Promise<ProductBySlugResult> {
  return fetchMedusaProductBySlug(slug);
}

export async function fetchProductById(
  productId: string,
): Promise<ProductBySlugResult> {
  return fetchMedusaProductById(productId);
}

/** Resolves identity without filtering out an out-of-stock product. */
export async function fetchProductIdentityBySlug(
  slug: string,
): Promise<ProductIdentityBySlugResult> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) return gate.reason;
  try {
    const sdk = createStorefrontMedusaSdk();
    const params = {
      region_id: getMedusaRegionId()!,
      handle: slug,
      limit: 1,
      fields: "id,handle,*variants",
    };
    const salesChannelId = getMedusaSalesChannelId();
    const query = (useSalesChannel: boolean) =>
      sdk.store.product.list(
        (useSalesChannel && salesChannelId
          ? withSalesChannelId(params)
          : params) as Parameters<typeof sdk.store.product.list>[0],
      );
    let { products } = await query(true);
    let raw = products?.[0] as unknown as Record<string, unknown> | undefined;
    if (!raw && salesChannelId) {
      ({ products } = await query(false));
      raw = products?.[0] as unknown as Record<string, unknown> | undefined;
    }
    if (!raw || typeof raw.id !== "string") return { kind: "not_found" };
    const variants = Array.isArray(raw.variants) ? raw.variants : [];
    return {
      kind: "ok",
      productId: raw.id,
      variantIds: variants
        .filter((variant): variant is Record<string, unknown> =>
          Boolean(variant && typeof variant === "object"),
        )
        .filter((variant) => variant.is_active !== false)
        .map((variant) => (typeof variant.id === "string" ? variant.id : ""))
        .filter(Boolean),
    };
  } catch (e) {
    return catalogServiceError(e);
  }
}

type CategorySummary = {
  id: string;
  handle: string;
  category: string;
  count: number;
  parentId: string | null;
};

export async function fetchCategorySummaries(): Promise<CategorySummariesResult> {
  const key = catalogEnvCacheFingerprint();
  const inFlight = categorySummariesInFlight.get(key);
  if (inFlight) return inFlight;
  const cached = unstable_cache(
    async () => {
      const result = await fetchMedusaCategorySummaries();
      return result.kind === "ok"
        ? { ...result, fetchedAt: new Date().toISOString() }
        : result;
    },
    ["storefront-category-summaries", catalogEnvCacheFingerprint()],
    {
      revalidate: 60,
      tags: ["catalog:list", "collections:index"],
    },
  );
  const request = cached().finally(() => categorySummariesInFlight.delete(key));
  categorySummariesInFlight.set(key, request);
  return request;
}

type VariantFacets = {
  types: string[];
  finishes: string[];
  brands: string[];
};

export async function fetchVariantFacets(
  category: string | undefined,
): Promise<VariantFacetsResult> {
  const normalizedCategory = category?.trim() || undefined;
  const key = `${catalogEnvCacheFingerprint()}:${normalizedCategory ?? "__all__"}`;
  const inFlight = variantFacetsInFlight.get(key);
  if (inFlight) return inFlight;
  const cached = unstable_cache(
    async () => fetchMedusaVariantFacets(normalizedCategory),
    [
      "storefront-variant-facets",
      catalogEnvCacheFingerprint(),
      normalizedCategory ?? "__all__",
    ],
    {
      revalidate: 60,
      tags: catalogCacheTags({ category: normalizedCategory }),
    },
  );
  const request = cached().finally(() => variantFacetsInFlight.delete(key));
  variantFacetsInFlight.set(key, request);
  return request;
}

export async function fetchProductSlugsForSitemap(
  maxItems?: number,
): Promise<string[]> {
  const gate = requireMedusaClientConfig();
  if (!gate.ok) return [];

  try {
    const sdk = createStorefrontMedusaSdk();
    const regionId = getMedusaRegionId()!;
    const slugs: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (maxItems == null || slugs.length < maxItems) {
      const { products } = await sdk.store.product.list(
        withSalesChannelId({
          region_id: regionId,
          limit: pageSize,
          offset,
          fields: `${MEDUSA_PRODUCT_STOCK_FIELDS},handle`,
          order: "-created_at",
        }) as Parameters<typeof sdk.store.product.list>[0],
      );
      for (const p of products ?? []) {
        if (!medusaProductRawHasSellableVariant(p as never)) continue;
        const h = (p as { handle?: string }).handle?.trim();
        if (h && !slugs.includes(h)) slugs.push(h);
      }
      if (!products?.length || products.length < pageSize) break;
      offset += pageSize;
    }

    return maxItems == null ? slugs : slugs.slice(0, maxItems);
  } catch {
    return [];
  }
}
