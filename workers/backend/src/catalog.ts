import type { WorkerDatabaseClient } from "./database.ts";

type CatalogRow = {
  id: string;
  title: string;
  handle: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  status: string;
  collection_id: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  variants: unknown;
  total_count: number | string;
};

export type CatalogProduct = {
  id: string;
  title: string;
  handle: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  status: string;
  collection_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  variants: Array<Record<string, unknown>>;
};

export type CatalogResponse = {
  products: CatalogProduct[];
  count: number;
  limit: number;
  offset: number;
};

type RegionRow = { id: string; name: string; currency_code: string };
type CollectionRow = { id: string; title: string; handle: string };
type CollectionProductRow = CollectionRow & {
  product_id: string | null;
  product_title: string | null;
  product_handle: string | null;
  product_subtitle: string | null;
  product_description: string | null;
  product_thumbnail: string | null;
  product_status: string | null;
  collection_id: string | null;
  variants: unknown;
  total_count: string | number;
};

function boundedInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Math.min(maximum, Number(value));
}

function mapRow(row: CatalogRow): CatalogProduct {
  const variants = Array.isArray(row.variants)
    ? row.variants.filter((variant): variant is Record<string, unknown> =>
        Boolean(
          variant && typeof variant === "object" && !Array.isArray(variant),
        ),
      )
    : [];
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    subtitle: row.subtitle,
    description: row.description,
    thumbnail: row.thumbnail,
    status: row.status,
    collection_id: row.collection_id,
    created_at: row.created_at ?? null,
    metadata: row.metadata ?? null,
    variants,
  };
}

export async function listPublishedProducts(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<CatalogResponse> {
  const url = new URL(request.url);
  const limit = boundedInteger(url.searchParams.get("limit"), 20, 100);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 100_000);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const productId = url.searchParams.get("id")?.trim() ?? "";
  const values: unknown[] = [];
  const filters: string[] = [];
  if (query) {
    values.push(`%${query}%`);
    filters.push(`AND (p.title ILIKE $${values.length} OR p.handle ILIKE $${values.length})`);
  }
  if (productId) {
    values.push(productId);
    filters.push(`AND p.id = $${values.length}`);
  }
  values.push(limit, offset);
  const limitParameter = values.length - 1;
  const offsetParameter = values.length;
  const result = await database.query<CatalogRow>(
    `SELECT p.id, p.title, p.handle, p.subtitle, p.description, p.thumbnail, p.status, p.collection_id,
            p.created_at, p.metadata,
            COALESCE(json_agg(json_build_object(
              'id', v.id, 'title', v.title, 'sku', v.sku, 'barcode', v.barcode,
              'thumbnail', v.thumbnail, 'allow_backorder', v.allow_backorder,
              'manage_inventory', v.manage_inventory, 'variant_rank', v.variant_rank,
              'calculated_price', (SELECT json_build_object(
                'calculated_amount', pr.amount, 'currency_code', pr.currency_code
              ) FROM public.product_variant_price_set pvps
              JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
              WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL AND pr.deleted_at IS NULL
                AND (pr.min_quantity IS NULL OR pr.min_quantity <= 1)
                AND (pr.max_quantity IS NULL OR pr.max_quantity >= 1)
              ORDER BY CASE WHEN pr.currency_code = 'php' THEN 0 ELSE 1 END, pr.amount ASC
              LIMIT 1),
              'inventory_quantity', COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
                FROM public.product_variant_inventory_item pvi
                JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
                WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL), 0)
            ) ORDER BY v.variant_rank NULLS LAST, v.id) FILTER (WHERE v.id IS NOT NULL), '[]'::json) AS variants,
            count(*) OVER() AS total_count
     FROM public.product p
     LEFT JOIN public.product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.status = 'published' ${filters.join(" ")}
     GROUP BY p.id
     ORDER BY p.updated_at DESC, p.id
     LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    values,
  );
  const count = Number(result.rows[0]?.total_count ?? 0);
  return { products: result.rows.map(mapRow), count, limit, offset };
}

export async function handleCatalogProductsRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const result = await listPublishedProducts(request, database);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}

export async function handleCatalogSearchSuggestionsRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return cacheableJson({ suggestions: [] });
  }
  const result = await listPublishedProducts(
    new Request(new URL(`/store/products?q=${encodeURIComponent(query)}&limit=24`, request.url)),
    database,
  );
  const suggestions = result.products.map((product) => {
    const prices = product.variants
      .map((variant) => {
        const calculated = variant.calculated_price;
        if (!calculated || typeof calculated !== "object") return null;
        const amount = (calculated as Record<string, unknown>).calculated_amount;
        return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
      })
      .filter((amount): amount is number => amount !== null);
    return {
      slug: product.handle,
      name: product.title,
      minPrice: prices.length ? Math.min(...prices) : null,
      ...(product.thumbnail ? { imageUrl: product.thumbnail } : {}),
    };
  });
  return cacheableJson({ suggestions });
}

export async function getPublishedProductByHandle(
  handle: string,
  database: WorkerDatabaseClient,
): Promise<CatalogProduct | null> {
  const normalized = handle.trim();
  if (!normalized || normalized.length > 255) return null;
  const result = await database.query<CatalogRow>(
    `SELECT p.id, p.title, p.handle, p.subtitle, p.description, p.thumbnail, p.status, p.collection_id,
            p.created_at, p.metadata,
            COALESCE(json_agg(json_build_object(
              'id', v.id, 'title', v.title, 'sku', v.sku, 'barcode', v.barcode,
              'thumbnail', v.thumbnail, 'allow_backorder', v.allow_backorder,
              'manage_inventory', v.manage_inventory, 'variant_rank', v.variant_rank,
              'calculated_price', (SELECT json_build_object(
                'calculated_amount', pr.amount, 'currency_code', pr.currency_code
              ) FROM public.product_variant_price_set pvps
              JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
              WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL AND pr.deleted_at IS NULL
                AND (pr.min_quantity IS NULL OR pr.min_quantity <= 1)
                AND (pr.max_quantity IS NULL OR pr.max_quantity >= 1)
              ORDER BY CASE WHEN pr.currency_code = 'php' THEN 0 ELSE 1 END, pr.amount ASC
              LIMIT 1),
              'inventory_quantity', COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
                FROM public.product_variant_inventory_item pvi
                JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
                WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL), 0)
            ) ORDER BY v.variant_rank NULLS LAST, v.id) FILTER (WHERE v.id IS NOT NULL), '[]'::json) AS variants,
            1 AS total_count
     FROM public.product p
     LEFT JOIN public.product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
     WHERE p.handle = $1 AND p.deleted_at IS NULL AND p.status = 'published'
     GROUP BY p.id`,
    [normalized],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function handleCatalogProductRequest(
  request: Request,
  database: WorkerDatabaseClient,
  handle: string,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const product = await getPublishedProductByHandle(handle, database);
  if (!product)
    return new Response(
      JSON.stringify({ type: "not_found", message: "Product not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  return new Response(JSON.stringify({ product }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}

function cacheableJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}

export async function handleRegionsRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const result = await database.query<RegionRow>(
    `SELECT id, name, currency_code
       FROM public.region
      WHERE deleted_at IS NULL
      ORDER BY name, id`,
  );
  return cacheableJson({ regions: result.rows });
}

export async function handleCollectionsRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const url = new URL(request.url);
  const limit = boundedInteger(url.searchParams.get("limit"), 20, 100);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 100_000);
  const result = await database.query<CollectionRow & { total_count: string | number }>(
    `SELECT pc.id, pc.title, pc.handle, count(*) OVER() AS total_count
       FROM public.product_collection pc
      WHERE pc.deleted_at IS NULL
      ORDER BY pc.title, pc.id
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return cacheableJson({
    collections: result.rows.map(({ total_count: _totalCount, ...row }) => row),
    count: Number(result.rows[0]?.total_count ?? 0),
    limit,
    offset,
  });
}

export async function handleCollectionRequest(
  request: Request,
  database: WorkerDatabaseClient,
  handle: string,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const normalized = handle.trim();
  if (!normalized || normalized.length > 255)
    return new Response(JSON.stringify({ type: "not_found", message: "Collection not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  const result = await database.query<CollectionProductRow>(
    `SELECT pc.id AS id, pc.title AS title, pc.handle AS handle,
            p.id AS product_id, p.title AS product_title, p.handle AS product_handle,
            p.subtitle AS product_subtitle, p.description AS product_description,
            p.thumbnail AS product_thumbnail, p.status AS product_status,
            p.collection_id, COALESCE(json_agg(json_build_object(
              'id', v.id, 'title', v.title, 'sku', v.sku, 'barcode', v.barcode,
              'thumbnail', v.thumbnail, 'allow_backorder', v.allow_backorder,
              'manage_inventory', v.manage_inventory, 'variant_rank', v.variant_rank
            ) ORDER BY v.variant_rank NULLS LAST, v.id) FILTER (WHERE v.id IS NOT NULL), '[]'::json) AS variants,
            0 AS total_count
       FROM public.product_collection pc
       LEFT JOIN public.product p
         ON p.collection_id = pc.id AND p.deleted_at IS NULL AND p.status = 'published'
       LEFT JOIN public.product_variant v
         ON v.product_id = p.id AND v.deleted_at IS NULL
      WHERE pc.handle = $1 AND pc.deleted_at IS NULL
      GROUP BY pc.id, pc.title, pc.handle, p.id
      ORDER BY p.updated_at DESC NULLS LAST, p.id`,
    [normalized],
  );
  const first = result.rows[0];
  if (!first)
    return new Response(JSON.stringify({ type: "not_found", message: "Collection not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  const products = result.rows
    .filter((row) => row.product_id)
    .map((row) => mapRow({
      id: row.product_id as string,
      title: row.product_title as string,
      handle: row.product_handle as string,
      subtitle: row.product_subtitle as string | null,
      description: row.product_description as string | null,
      thumbnail: row.product_thumbnail as string | null,
      status: row.product_status as string,
      collection_id: row.collection_id,
      variants: row.variants,
      total_count: 0,
    }));
  return cacheableJson({
    collection: { id: first.id, title: first.title, handle: first.handle },
    products,
    count: products.length,
  });
}
