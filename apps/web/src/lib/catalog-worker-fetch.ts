/**
 * Worker-native storefront catalog queries.
 *
 * The storefront reads published catalog data exclusively through the Worker
 * API; no legacy commerce runtime is involved.
 */
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { Product } from "@universal-music-store/types";
import {
  catalogProductFromMedusaRaw,
  minVariantPrice,
  productMatchesBrand,
  productMatchesPriceRange,
  productMatchesVariantFilters,
} from "./medusa-catalog-mapper";
import { readResponseJson } from "./read-response-json";

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

type CategorySummary = {
  id: string;
  handle: string;
  category: string;
  count: number;
  parentId: string | null;
};

export type CategorySummariesResult =
  | { kind: "ok"; summaries: CategorySummary[]; fetchedAt?: string }
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

type WorkerCatalogProduct = {
  id?: string;
  title?: string;
  handle?: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  status?: string;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  variants?: Array<Record<string, unknown>> | null;
};

function misconfigured(detail: string): CommerceFetchFailure {
  return { kind: "misconfigured", detail };
}

function workerBaseUrl(): string | null {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  return base || null;
}

function workerUrl(path: string): string | null {
  const base = workerBaseUrl();
  return base ? `${base}${path}` : null;
}

function catalogServiceError(error: unknown): CommerceFetchFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid url/i.test(message)) {
    return misconfigured("Worker API URL is missing or invalid. Set API_URL.");
  }
  return { kind: "service_error", message };
}

function cacheFingerprint(): string {
  return createHash("sha256")
    .update(`worker-v1|${workerBaseUrl() ?? ""}`)
    .digest("hex")
    .slice(0, 12);
}

function cacheTags(options: CatalogQuery): string[] {
  const tags = ["catalog:list"];
  if (options.category?.trim())
    tags.push(`collection:${options.category.trim().toLowerCase()}`);
  if (options.q?.trim()) tags.push("catalog:search");
  return tags;
}

async function cacheSuccessfulRead<T extends { kind: string }>(
  loader: () => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): Promise<T> {
  const cached = unstable_cache(
    async () => {
      const result = await loader();
      return result.kind === "ok" ? result : null;
    },
    keyParts,
    options,
  );
  return (await cached()) ?? loader();
}

export function mapWorkerCatalogProduct(
  raw: WorkerCatalogProduct,
): Product | null {
  if (!raw.id || !raw.title || !raw.handle) return null;
  const variants = (raw.variants ?? []).map((variant) => ({
    ...variant,
    product_id: raw.id,
    options: [],
  }));
  return catalogProductFromMedusaRaw({
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    subtitle: raw.subtitle ?? null,
    description: raw.description ?? null,
    thumbnail: raw.thumbnail ?? null,
    status: raw.status ?? "published",
    created_at: raw.created_at ?? null,
    metadata: raw.metadata ?? null,
    images: raw.thumbnail ? [{ url: raw.thumbnail }] : [],
    categories: [],
    variants,
  } as never);
}

async function fetchWorkerProducts(
  limit: number,
  options: CatalogQuery,
): Promise<ProductsPageResult> {
  const base = workerUrl("/store/products");
  if (!base)
    return misconfigured("Set API_URL to the deployed Worker address.");
  const params = new URLSearchParams({
    limit: "100",
    offset: String(options.offset ?? 0),
  });
  if (options.q?.trim()) params.set("q", options.q.trim());
  try {
    const response = await fetch(`${base}?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok)
      return {
        kind: "service_error",
        message: `Worker catalog returned ${response.status}`,
      };
    const payload = await readResponseJson(
      response,
      {} as {
        products?: WorkerCatalogProduct[];
        count?: number;
      },
    );
    let products = (payload.products ?? [])
      .flatMap((rawProduct) => {
        const product = mapWorkerCatalogProduct(rawProduct);
        return product ? [product] : [];
      })
      .filter((product) => productMatchesVariantFilters(product, options))
      .filter((product) => productMatchesBrand(product, options.brand))
      .filter((product) =>
        productMatchesPriceRange(product, options.minPrice, options.maxPrice),
      );
    if (options.sort === "price_asc" || options.sort === "price_desc") {
      products.sort((a, b) => {
        const difference = minVariantPrice(a) - minVariantPrice(b);
        return options.sort === "price_asc" ? difference : -difference;
      });
    } else if (options.sort === "name_asc") {
      products.sort((a, b) => a.name.localeCompare(b.name));
    }
    return {
      kind: "ok",
      products: products.slice(0, limit),
      total: Number(payload.count ?? products.length),
    };
  } catch (error) {
    return catalogServiceError(error);
  }
}

const productPageInFlight = new Map<string, Promise<ProductsPageResult>>();

export async function fetchProductsPage(
  limit: number,
  options: CatalogQuery = {},
): Promise<ProductsPageResult> {
  if (!workerBaseUrl())
    return misconfigured("Set API_URL to the deployed Worker address.");
  const normalized = Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() || undefined : value,
    ]),
  ) as CatalogQuery;
  const key = JSON.stringify([limit, normalized]);
  const inFlight = productPageInFlight.get(key);
  if (inFlight) return inFlight;
  const request = cacheSuccessfulRead(
    () => fetchWorkerProducts(limit, normalized),
    [
      "storefront-worker-products-v1",
      cacheFingerprint(),
      String(limit),
      JSON.stringify(normalized),
    ],
    { revalidate: normalized.revalidate ?? 60, tags: cacheTags(normalized) },
  ).finally(() => productPageInFlight.delete(key));
  productPageInFlight.set(key, request);
  return request;
}

export async function fetchFeaturedProducts(
  limit = 4,
): Promise<FeaturedProductsResult> {
  const result = await fetchProductsPage(limit, { sort: "newest" });
  return result.kind === "ok"
    ? { kind: "ok", products: result.products }
    : result;
}

export async function fetchRelatedProducts(
  current: Product,
  limit = 4,
): Promise<FeaturedProductsResult> {
  const relatedResults = await Promise.all(
    current.relatedHandles
      .flatMap((value) => {
        const normalized = value.trim();
        return normalized ? [normalized] : [];
      })
      .slice(0, 8)
      .map((handle) => fetchProductBySlug(handle)),
  );
  const related = relatedResults.flatMap((result) =>
    result.kind === "ok" && result.product.id !== current.id
      ? [result.product]
      : [],
  );
  if (related.length >= limit || !current.category?.trim())
    return { kind: "ok", products: related.slice(0, limit) };
  const catalog = await fetchProductsPage(limit + 10, {
    category: current.category,
  });
  if (catalog.kind !== "ok") return catalog;
  return {
    kind: "ok",
    products: [
      ...related,
      ...catalog.products.filter((product) => product.id !== current.id),
    ].slice(0, limit),
  };
}

export async function fetchProductBySlug(
  slug: string,
): Promise<ProductBySlugResult> {
  const url = workerUrl(`/store/products/${encodeURIComponent(slug)}`);
  if (!url) return misconfigured("Set API_URL to the deployed Worker address.");
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) return { kind: "not_found" };
    if (!response.ok)
      return {
        kind: "service_error",
        message: `Worker catalog returned ${response.status}`,
      };
    const payload = await readResponseJson(
      response,
      {} as {
        product?: WorkerCatalogProduct;
      },
    );
    const product = payload.product
      ? mapWorkerCatalogProduct(payload.product)
      : null;
    return product ? { kind: "ok", product } : { kind: "not_found" };
  } catch (error) {
    return catalogServiceError(error);
  }
}

const emptyFacets = {
  types: [],
  finishes: [],
  brands: [],
  pickupConfigs: [],
  bodyWoods: [],
  conditions: [],
  skillLevels: [],
  shippingSpeeds: [],
};

export async function fetchCategorySummaries(): Promise<CategorySummariesResult> {
  const base = workerUrl("/store/catalog/categories");
  if (!base) return misconfigured("Set API_URL to the deployed Worker address.");
  try {
    const response = await fetch(base, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60, tags: ["storefront:catalog-categories"] },
    });
    if (!response.ok)
      return {
        kind: "service_error",
        message: `Worker catalog categories returned ${response.status}`,
      };
    const payload = await readResponseJson(response, {} as {
      categories?: Array<{
        id?: string;
        handle?: string;
        category?: string;
        count?: number;
        parentId?: string | null;
      }>;
    });
    const summaries = (payload.categories ?? []).flatMap((category) => {
      if (!category.id || !category.handle || !category.category) return [];
      return [{
        id: category.id,
        handle: category.handle,
        category: category.category,
        count: Number(category.count ?? 0),
        parentId: category.parentId ?? null,
      }];
    });
    return { kind: "ok", summaries, fetchedAt: new Date().toISOString() };
  } catch (error) {
    return catalogServiceError(error);
  }
}

export async function fetchVariantFacets(
  _category?: string,
): Promise<VariantFacetsResult> {
  if (!workerBaseUrl())
    return misconfigured("Set API_URL to the deployed Worker address.");
  return {
    kind: "ok",
    facets: emptyFacets,
    quality: {
      rawProducts: 0,
      mappedProducts: 0,
      facetValuesSeen: 0,
      invalidFacetValues: 0,
    },
  };
}

export async function fetchProductSlugsForSitemap(
  maxItems?: number,
): Promise<string[]> {
  if (!workerBaseUrl()) return [];
  const slugs: string[] = [];
  const seenSlugs = new Set<string>();
  const pageSize = 100;
  for (
    let offset = 0;
    maxItems == null || slugs.length < maxItems;
    offset += pageSize
  ) {
    const result = await fetchWorkerProducts(pageSize, { offset });
    if (result.kind !== "ok") return [];
    for (const product of result.products)
      if (product.slug && !seenSlugs.has(product.slug)) {
        seenSlugs.add(product.slug);
        slugs.push(product.slug);
      }
    if (result.products.length < pageSize) break;
  }
  return maxItems == null ? slugs : slugs.slice(0, maxItems);
}
