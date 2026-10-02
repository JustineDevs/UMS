import type { WorkerDatabaseClient } from "./database.ts";
import { normalizeCatalogMediaUrl } from "./catalog-media.ts";
export { normalizeCatalogMediaUrl } from "./catalog-media.ts";

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
  product_metadata: Record<string, unknown> | null;
  variants: unknown;
  total_count: string | number;
};

type CatalogCategoryRow = {
  id: string;
  handle: string;
  name: string;
  parent_category_id: string | null;
  product_count: string | number;
};

type CatalogFacetRow = {
  facet: string;
  value: string | null;
  product_id: string | null;
  raw_products: string | number;
};

function boundedInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Math.min(maximum, Number(value));
}

function nonNegativeNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// A published product without approved media cannot be rendered as a usable
// storefront item. Keep legacy rows out of public catalog reads until staff
// attach a canonical product or variant image.
function publishedMediaPredicate(alias: string): string {
  return `AND ((${alias}.thumbnail IS NOT NULL AND ${alias}.thumbnail NOT ILIKE '%gvsyfyaqxfrunoghgqiq.supabase.co%') OR EXISTS (
    SELECT 1
    FROM public.product_variant published_media_variant
    WHERE published_media_variant.product_id = ${alias}.id
      AND published_media_variant.deleted_at IS NULL
      AND published_media_variant.thumbnail IS NOT NULL
      AND published_media_variant.thumbnail NOT ILIKE '%gvsyfyaqxfrunoghgqiq.supabase.co%'
  ))`;
}

function sellableVariantPredicate(productAlias: string): string {
  return `AND EXISTS (
    SELECT 1
    FROM public.product_variant sellable_variant
    WHERE sellable_variant.product_id = ${productAlias}.id
      AND sellable_variant.deleted_at IS NULL
      AND (
        sellable_variant.manage_inventory = FALSE
        OR NOT EXISTS (
          SELECT 1
          FROM public.product_variant_inventory_item sellable_pvi
          WHERE sellable_pvi.variant_id = sellable_variant.id
            AND sellable_pvi.deleted_at IS NULL
        )
        OR COALESCE((SELECT SUM(sellable_il.stocked_quantity - sellable_il.reserved_quantity)
          FROM public.product_variant_inventory_item sellable_pvi
          JOIN public.inventory_level sellable_il
            ON sellable_il.inventory_item_id = sellable_pvi.inventory_item_id
           AND sellable_il.deleted_at IS NULL
          WHERE sellable_pvi.variant_id = sellable_variant.id
            AND sellable_pvi.deleted_at IS NULL), 0) > 0
      )
  )`;
}

function mapRow(row: CatalogRow): CatalogProduct {
  const variants = Array.isArray(row.variants)
    ? row.variants.filter((variant): variant is Record<string, unknown> =>
        Boolean(
          variant && typeof variant === "object" && !Array.isArray(variant),
        ),
      ).map((variant) => ({
        ...variant,
        ...(Object.prototype.hasOwnProperty.call(variant, "thumbnail")
          ? { thumbnail: normalizeCatalogMediaUrl(variant.thumbnail) }
          : {}),
      }))
    : [];
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    subtitle: row.subtitle,
    description: row.description,
    thumbnail: normalizeCatalogMediaUrl(row.thumbnail),
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
  const category = url.searchParams.get("category")?.trim() ?? "";
  const brand = url.searchParams.get("brand")?.trim() ?? "";
  const minPrice = nonNegativeNumber(url.searchParams.get("minPrice"));
  const maxPrice = nonNegativeNumber(url.searchParams.get("maxPrice"));
  const requestedSort = url.searchParams.get("sort")?.trim();
  const sort = requestedSort === "name_asc" || requestedSort === "price_asc" || requestedSort === "price_desc"
    ? requestedSort
    : "newest";
  const values: unknown[] = [];
  const filters: string[] = [];
  if (query) {
    values.push(`%${query}%`);
    filters.push(`AND (
      p.title ILIKE $${values.length}
      OR p.handle ILIKE $${values.length}
      OR EXISTS (
        SELECT 1
        FROM public.product_variant search_variant
        WHERE search_variant.product_id = p.id
          AND search_variant.deleted_at IS NULL
          AND (search_variant.sku ILIKE $${values.length} OR search_variant.barcode ILIKE $${values.length})
      )
    )`);
  }
  if (productId) {
    values.push(productId);
    filters.push(`AND p.id = $${values.length}`);
  }
  if (category) {
    values.push(category);
    filters.push(`AND EXISTS (
      SELECT 1
      FROM public.product_category_product category_link
      JOIN public.product_category category_row
        ON category_row.id = category_link.product_category_id
       AND category_row.deleted_at IS NULL
       AND category_row.is_active = true
      WHERE category_link.product_id = p.id
        AND (category_row.handle = $${values.length}
          OR lower(category_row.name) = lower($${values.length}))
    )`);
  }
  if (brand) {
    values.push(brand);
    filters.push(`AND lower(COALESCE(p.metadata ->> 'brand', p.metadata ->> 'brand_name', p.metadata ->> 'legacy_brand', '')) = lower($${values.length})`);
  }
  const phpMinimumPriceExpression = `(SELECT MIN(pr.amount)
        FROM public.product_variant_price_set pvps
        JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
        JOIN public.product_variant priced_variant ON priced_variant.id = pvps.variant_id
        WHERE priced_variant.product_id = p.id
          AND priced_variant.deleted_at IS NULL
          AND pvps.deleted_at IS NULL
          AND pr.deleted_at IS NULL
          AND pr.currency_code = 'php'
          AND (pr.min_quantity IS NULL OR pr.min_quantity <= 1)
          AND (pr.max_quantity IS NULL OR pr.max_quantity >= 1))`;
  if (minPrice !== null) {
    values.push(Math.round(minPrice * 100));
    filters.push(`AND ${phpMinimumPriceExpression} >= $${values.length}`);
  }
  if (maxPrice !== null) {
    values.push(Math.round(maxPrice * 100));
    filters.push(`AND ${phpMinimumPriceExpression} <= $${values.length}`);
  }
  const addVariantAttributeFilter = (
    value: string,
    optionPattern: string,
    metadataKeys: string[],
  ): void => {
    values.push(value);
    const parameter = `$${values.length}`;
    const metadata = metadataKeys
      .map((key) => `vf.metadata ->> '${key}'`)
      .join(", ");
    const productMetadata = metadataKeys
      .map((key) => `p.metadata ->> '${key}'`)
      .join(", ");
    filters.push(`AND EXISTS (
      SELECT 1
      FROM public.product_variant vf
      LEFT JOIN public.product_variant_option vf_pvo ON vf_pvo.variant_id = vf.id
      LEFT JOIN public.product_option_value vf_pov
        ON vf_pov.id = vf_pvo.option_value_id AND vf_pov.deleted_at IS NULL
      LEFT JOIN public.product_option vf_po
        ON vf_po.id = vf_pov.option_id AND vf_po.deleted_at IS NULL
      WHERE vf.product_id = p.id
        AND vf.deleted_at IS NULL
        AND (
          (lower(vf_po.title) LIKE '${optionPattern}' AND lower(vf_pov.value) = lower(${parameter}))
          OR lower(COALESCE(${metadata}, ${productMetadata}, '')) = lower(${parameter})
        )
    )`);
  };
  const variantFilters: Array<{
    value: string;
    optionPattern: string;
    metadataKeys: string[];
  }> = [
    { value: url.searchParams.get("type")?.trim() ?? "", optionPattern: "%type%", metadataKeys: ["type", "model"] },
    { value: url.searchParams.get("finish")?.trim() ?? "", optionPattern: "%finish%", metadataKeys: ["finish", "color", "colour"] },
    { value: url.searchParams.get("pickupConfig")?.trim() ?? "", optionPattern: "%pickup%", metadataKeys: ["pickup_config", "pickupConfig", "pickup"] },
    { value: url.searchParams.get("bodyWood")?.trim() ?? "", optionPattern: "%body%wood%", metadataKeys: ["body_wood", "bodyWood", "wood"] },
    { value: url.searchParams.get("condition")?.trim() ?? "", optionPattern: "%condition%", metadataKeys: ["condition"] },
    { value: url.searchParams.get("skillLevel")?.trim() ?? "", optionPattern: "%skill%", metadataKeys: ["skill_level", "skillLevel", "playing_level"] },
    { value: url.searchParams.get("shippingSpeed")?.trim() ?? "", optionPattern: "%shipping%", metadataKeys: ["shipping_speed", "shippingSpeed", "shipping"] },
  ];
  for (const filter of variantFilters) {
    if (filter.value) addVariantAttributeFilter(filter.value, filter.optionPattern, filter.metadataKeys);
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
              'metadata', COALESCE(v.metadata, '{}'::jsonb),
              'options', COALESCE((SELECT json_agg(json_build_object(
                'id', pov.id, 'value', pov.value,
                'option', json_build_object('id', po.id, 'title', po.title)
                ) ORDER BY po.id, pov.id)
                FROM public.product_variant_option pvo
                JOIN public.product_option_value pov
                  ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
                JOIN public.product_option po
                  ON po.id = pov.option_id AND po.deleted_at IS NULL
                WHERE pvo.variant_id = v.id), '[]'::json),
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
     WHERE p.deleted_at IS NULL AND p.status = 'published' ${publishedMediaPredicate("p")} ${sellableVariantPredicate("p")} ${filters.join(" ")}
     GROUP BY p.id
     ORDER BY ${sort === "name_asc"
       ? "p.title ASC, p.id"
       : sort === "price_asc"
         ? `${phpMinimumPriceExpression} ASC NULLS LAST, p.id`
         : sort === "price_desc"
           ? `${phpMinimumPriceExpression} DESC NULLS LAST, p.id`
           : "p.updated_at DESC, p.id"}
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

export async function handleSocialProofRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const result = await database.query<{ customer_count: string | number }>(
    `SELECT COUNT(*) AS customer_count FROM public.customer WHERE deleted_at IS NULL`,
  );
  return cacheableJson({ customerCount: Number(result.rows[0]?.customer_count ?? 0) });
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
              'metadata', COALESCE(v.metadata, '{}'::jsonb),
              'options', COALESCE((SELECT json_agg(json_build_object(
                'id', pov.id, 'value', pov.value,
                'option', json_build_object('id', po.id, 'title', po.title)
                ) ORDER BY po.id, pov.id)
                FROM public.product_variant_option pvo
                JOIN public.product_option_value pov
                  ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
                JOIN public.product_option po
                  ON po.id = pov.option_id AND po.deleted_at IS NULL
                WHERE pvo.variant_id = v.id), '[]'::json),
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
     WHERE p.handle = $1 AND p.deleted_at IS NULL AND p.status = 'published' ${publishedMediaPredicate("p")} ${sellableVariantPredicate("p")}
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
      ORDER BY name, id
      LIMIT 100`,
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

export async function handleCatalogCategoriesRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const result = await database.query<CatalogCategoryRow>(
    `SELECT pc.id, pc.handle, pc.name, pc.parent_category_id,
            COUNT(DISTINCT p.id) AS product_count
       FROM public.product_category pc
       LEFT JOIN public.product_category_product pcp
         ON pcp.product_category_id = pc.id
       LEFT JOIN public.product p
         ON p.id = pcp.product_id
        AND p.deleted_at IS NULL
        AND p.status = 'published'
        ${publishedMediaPredicate("p")}
        ${sellableVariantPredicate("p")}
      WHERE pc.deleted_at IS NULL
        AND pc.is_active = true
      GROUP BY pc.id, pc.handle, pc.name, pc.parent_category_id, pc.rank
      ORDER BY pc.rank, pc.name, pc.id
      LIMIT 500`,
  );
  return cacheableJson({
    categories: result.rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      category: row.name,
      count: Number(row.product_count ?? 0),
      parentId: row.parent_category_id,
    })),
  });
}

export async function handleCatalogFacetsRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const category = new URL(request.url).searchParams.get("category")?.trim() ?? "";
  const values: unknown[] = category ? [category] : [];
  const categoryFilter = category
    ? `AND EXISTS (
        SELECT 1
        FROM public.product_category_product facet_category_link
        JOIN public.product_category facet_category
          ON facet_category.id = facet_category_link.product_category_id
         AND facet_category.deleted_at IS NULL
         AND facet_category.is_active = true
        WHERE facet_category_link.product_id = p.id
          AND (facet_category.handle = $1 OR lower(facet_category.name) = lower($1))
      )`
    : "";
  const result = await database.query<CatalogFacetRow>(
    `WITH visible_products AS (
       SELECT p.id, p.metadata
       FROM public.product p
       WHERE p.deleted_at IS NULL
         AND p.status = 'published'
         ${publishedMediaPredicate("p")}
         ${sellableVariantPredicate("p")}
         ${categoryFilter}
     ), visible_variants AS (
       SELECT v.id, v.product_id, v.metadata, vp.metadata AS product_metadata
       FROM public.product_variant v
       JOIN visible_products vp ON vp.id = v.product_id
       WHERE v.deleted_at IS NULL
     )
     SELECT facet, value, product_id, raw_products
     FROM (
       SELECT 'types' AS facet, pov.value, vv.product_id, (SELECT COUNT(*) FROM visible_products) AS raw_products
       FROM public.product_variant_option pvo
       JOIN visible_variants vv ON vv.id = pvo.variant_id
       JOIN public.product_option_value pov ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
       JOIN public.product_option po ON po.id = pov.option_id AND po.deleted_at IS NULL
       WHERE lower(po.title) LIKE '%type%' OR lower(po.title) LIKE '%model%'
       UNION ALL
       SELECT 'finishes', pov.value, vv.product_id, (SELECT COUNT(*) FROM visible_products)
       FROM public.product_variant_option pvo
       JOIN visible_variants vv ON vv.id = pvo.variant_id
       JOIN public.product_option_value pov ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
       JOIN public.product_option po ON po.id = pov.option_id AND po.deleted_at IS NULL
       WHERE lower(po.title) LIKE '%finish%' OR lower(po.title) LIKE '%color%' OR lower(po.title) LIKE '%colour%'
       UNION ALL
       SELECT 'pickupConfigs', COALESCE(vv.metadata ->> key, vv.product_metadata ->> key), vv.product_id, (SELECT COUNT(*) FROM visible_products)
       FROM visible_variants vv CROSS JOIN unnest(ARRAY['pickup_config', 'pickupConfig', 'pickup']) AS keys(key)
       WHERE NULLIF(trim(COALESCE(vv.metadata ->> key, vv.product_metadata ->> key)), '') IS NOT NULL
       UNION ALL
       SELECT 'bodyWoods', COALESCE(vv.metadata ->> key, vv.product_metadata ->> key), vv.product_id, (SELECT COUNT(*) FROM visible_products)
       FROM visible_variants vv CROSS JOIN unnest(ARRAY['body_wood', 'bodyWood', 'wood']) AS keys(key)
       WHERE NULLIF(trim(COALESCE(vv.metadata ->> key, vv.product_metadata ->> key)), '') IS NOT NULL
       UNION ALL
       SELECT 'conditions', COALESCE(vv.metadata ->> 'condition', vv.product_metadata ->> 'condition'), vv.product_id, (SELECT COUNT(*) FROM visible_products)
       FROM visible_variants vv
       WHERE NULLIF(trim(COALESCE(vv.metadata ->> 'condition', vv.product_metadata ->> 'condition')), '') IS NOT NULL
       UNION ALL
       SELECT 'skillLevels', COALESCE(vv.metadata ->> key, vv.product_metadata ->> key), vv.product_id, (SELECT COUNT(*) FROM visible_products)
       FROM visible_variants vv CROSS JOIN unnest(ARRAY['skill_level', 'skillLevel', 'playing_level']) AS keys(key)
       WHERE NULLIF(trim(COALESCE(vv.metadata ->> key, vv.product_metadata ->> key)), '') IS NOT NULL
       UNION ALL
       SELECT 'shippingSpeeds', COALESCE(vv.metadata ->> key, vv.product_metadata ->> key), vv.product_id, (SELECT COUNT(*) FROM visible_products)
       FROM visible_variants vv CROSS JOIN unnest(ARRAY['shipping_speed', 'shippingSpeed', 'shipping']) AS keys(key)
       WHERE NULLIF(trim(COALESCE(vv.metadata ->> key, vv.product_metadata ->> key)), '') IS NOT NULL
       UNION ALL
       SELECT 'brands', vp.metadata ->> key, vp.id, (SELECT COUNT(*) FROM visible_products)
       FROM visible_products vp CROSS JOIN unnest(ARRAY['brand', 'brand_name', 'legacy_brand']) AS keys(key)
       WHERE NULLIF(trim(vp.metadata ->> key), '') IS NOT NULL
       UNION ALL
       SELECT '__quality__', NULL, NULL, COUNT(*)
       FROM visible_products
     ) facets
     ORDER BY facet, lower(value), value`,
    values,
  );
  const facets = {
    types: [], finishes: [], brands: [], pickupConfigs: [], bodyWoods: [],
    conditions: [], skillLevels: [], shippingSpeeds: [],
  } as Record<string, string[]>;
  let rawProducts = 0;
  let facetValuesSeen = 0;
  let invalidFacetValues = 0;
  const normalizeFacetValue = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/\s+/gu, " ");
    if (!normalized || normalized.length > 80 || new Set(["n/a", "na", "none", "null", "unknown", "-", "—"]).has(normalized.toLowerCase())) return null;
    return normalized;
  };
  for (const row of result.rows) {
    rawProducts = Number(row.raw_products ?? rawProducts);
    if (row.facet === "__quality__") continue;
    facetValuesSeen += 1;
    const value = normalizeFacetValue(row.value);
    if (!value) {
      invalidFacetValues += 1;
      continue;
    }
    if (facets[row.facet] && !facets[row.facet]!.includes(value)) facets[row.facet]!.push(value);
  }
  return cacheableJson({
    facets,
    quality: {
      rawProducts,
      mappedProducts: rawProducts,
      facetValuesSeen,
      invalidFacetValues,
    },
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
            p.collection_id, p.metadata AS product_metadata,
            COALESCE(json_agg(json_build_object(
              'id', v.id, 'title', v.title, 'sku', v.sku, 'barcode', v.barcode,
              'thumbnail', v.thumbnail, 'allow_backorder', v.allow_backorder,
              'manage_inventory', v.manage_inventory, 'variant_rank', v.variant_rank,
              'metadata', COALESCE(v.metadata, '{}'::jsonb),
              'options', COALESCE((SELECT json_agg(json_build_object(
                'id', pov.id, 'value', pov.value,
                'option', json_build_object('id', po.id, 'title', po.title)
                ) ORDER BY po.id, pov.id)
                FROM public.product_variant_option pvo
                JOIN public.product_option_value pov
                  ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
                JOIN public.product_option po
                  ON po.id = pov.option_id AND po.deleted_at IS NULL
                WHERE pvo.variant_id = v.id), '[]'::json),
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
            0 AS total_count
       FROM public.product_collection pc
       LEFT JOIN public.product p
         ON p.collection_id = pc.id AND p.deleted_at IS NULL AND p.status = 'published'
         ${publishedMediaPredicate("p")} ${sellableVariantPredicate("p")}
       LEFT JOIN public.product_variant v
         ON v.product_id = p.id AND v.deleted_at IS NULL
      WHERE pc.handle = $1 AND pc.deleted_at IS NULL
      GROUP BY pc.id, pc.title, pc.handle, p.id
      ORDER BY p.updated_at DESC NULLS LAST, p.id
      LIMIT 500`,
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
      metadata: row.product_metadata,
      variants: row.variants,
      total_count: 0,
    }));
  return cacheableJson({
    collection: { id: first.id, title: first.title, handle: first.handle },
    products,
    count: products.length,
  });
}
