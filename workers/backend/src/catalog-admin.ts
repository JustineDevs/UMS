import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string };
type OptionInput = { size: string; color: string };
type ProductInput = {
  expectedRevision?: string;
  title: string; handle?: string; description?: string | null;
  status?: "draft" | "published"; pricePhp: number; sku?: string | null;
  skuProvided?: boolean; variantBarcodeProvided?: boolean;
  imageUrls?: string[]; thumbnail?: string | null; categoryIds?: string[];
  sizeLabel?: string | null; colorLabel?: string | null;
  sizeLabels?: string[] | null; colorLabels?: string[] | null;
  stockQuantity?: number; variantBarcode?: string | null;
  storefrontMetadata?: Record<string, unknown> | null;
  variantStocks?: Array<{ variantId: string; quantity: number }>;
  matrixCellStocks?: Array<{ sizeLabel: string; colorLabel: string; quantity: number }>;
};
type ParsedStock = { valid: true; quantity?: number } | { valid: false };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function clean(value: unknown, max = 200): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200); }
function unique(values: unknown[], max = 40): string[] { return [...new Set(values.filter((v): v is string => typeof v === "string").map((v) => v.trim().slice(0, 100)).filter(Boolean))].slice(0, max); }
function amount(value: number): number { return Math.round(value * 100); }
function parseStockQuantity(value: unknown, optional = false): ParsedStock {
  if (optional && (value === undefined || value === null || value === "")) return { valid: true };
  const quantity = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 10_000_000) return { valid: false };
  return { valid: true, quantity };
}
function parseVariantStocks(value: unknown): Array<{ variantId: string; quantity: number }> | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 80) return null;
  const seen = new Set<string>();
  const rows: Array<{ variantId: string; quantity: number }> = [];
  for (const item of value) {
    if (!record(item)) return null;
    if (Object.keys(item).some((key) => key !== "variantId" && key !== "quantity")) return null;
    const variantId = clean(item.variantId, 201);
    const parsed = parseStockQuantity(item.quantity);
    if (!variantId || variantId.length > 200 || seen.has(variantId) || !parsed.valid || parsed.quantity === undefined) return null;
    seen.add(variantId);
    rows.push({ variantId, quantity: parsed.quantity });
  }
  return rows;
}
function parseMatrixCellStocks(value: unknown): Array<{ sizeLabel: string; colorLabel: string; quantity: number }> | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 80) return null;
  const seen = new Set<string>();
  const rows: Array<{ sizeLabel: string; colorLabel: string; quantity: number }> = [];
  for (const item of value) {
    if (!record(item)) return null;
    if (Object.keys(item).some((key) => key !== "sizeLabel" && key !== "colorLabel" && key !== "quantity")) return null;
    const sizeLabel = typeof item.sizeLabel === "string" ? item.sizeLabel.trim() : "";
    const colorLabel = typeof item.colorLabel === "string" ? item.colorLabel.trim() : "";
    const parsed = parseStockQuantity(item.quantity);
    const key = `${sizeLabel}\u0000${colorLabel}`;
    if (!sizeLabel || sizeLabel.length > 200 || !colorLabel || colorLabel.length > 200 || seen.has(key) || !parsed.valid || parsed.quantity === undefined) return null;
    seen.add(key);
    rows.push({ sizeLabel, colorLabel, quantity: parsed.quantity });
  }
  return rows;
}
function validImageReference(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  const reference = value.trim();
  if (reference.startsWith("/")) return !reference.startsWith("//");
  try {
    const url = new URL(reference);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}
function pairs(input: ProductInput): OptionInput[] {
  const sizes = unique(input.sizeLabels ?? (input.sizeLabel ? [input.sizeLabel] : ["One Size"]));
  const colors = unique(input.colorLabels ?? (input.colorLabel ? [input.colorLabel] : ["Default"]));
  if (!sizes.length || !colors.length || sizes.length * colors.length > 80) return [];
  return sizes.flatMap((size) => colors.map((color) => ({ size, color })));
}
function input(value: unknown): ProductInput | null {
  if (!record(value) || typeof value.title !== "string" || typeof value.pricePhp !== "number" || !Number.isFinite(value.pricePhp) || value.pricePhp < 0 || !Number.isSafeInteger(Math.round(value.pricePhp * 100))) return null;
  if (value.status !== undefined && value.status !== "draft" && value.status !== "published") return null;
  for (const key of ["imageUrls", "categoryIds", "sizeLabels", "colorLabels"] as const) {
    const values = value[key];
    if (values === undefined) continue;
    if (!Array.isArray(values) || values.length > 80 || values.some((entry) => typeof entry !== "string" || !entry.trim() || entry.trim().length > 100)) return null;
  }
  if (value.storefrontMetadata !== undefined && value.storefrontMetadata !== null && !record(value.storefrontMetadata)) return null;
  for (const [key, max] of [["sku", 120], ["variantBarcode", 120], ["handle", 200], ["description", 50_000]] as const) {
    const field = value[key];
    if (field !== undefined && field !== null && (typeof field !== "string" || field.length > max)) return null;
  }
  for (const key of ["sizeLabel", "colorLabel"] as const) {
    const field = value[key];
    if (field !== undefined && field !== null && (typeof field !== "string" || field.trim().length > 100)) return null;
  }
  const stock = parseStockQuantity(value.stockQuantity, true);
  const variantStocks = parseVariantStocks(value.variantStocks);
  const matrixCellStocks = parseMatrixCellStocks(value.matrixCellStocks);
  if (!stock.valid || variantStocks === null || matrixCellStocks === null) return null;
  if (Array.isArray(value.imageUrls) && value.imageUrls.some((url) => !validImageReference(url))) return null;
  if (value.thumbnail !== undefined && value.thumbnail !== null && value.thumbnail !== "" && !validImageReference(value.thumbnail)) return null;
  const imageUrls = Array.isArray(value.imageUrls) ? value.imageUrls.map((url) => (url as string).trim()) : undefined;
  const categories = Array.isArray(value.categoryIds) ? unique(value.categoryIds, 100) : undefined;
  return {
    expectedRevision: clean(value.expected_revision ?? value.expectedRevision, 100) || undefined,
    title: clean(value.title, 500), handle: clean(value.handle, 200), description: typeof value.description === "string" ? value.description : null,
    status: value.status === "published" ? "published" : "draft", pricePhp: value.pricePhp, sku: typeof value.sku === "string" ? clean(value.sku, 200) || null : null,
    imageUrls, thumbnail: typeof value.thumbnail === "string" ? clean(value.thumbnail, 8000) || null : undefined, categoryIds: categories,
    sizeLabel: typeof value.sizeLabel === "string" ? value.sizeLabel : null, colorLabel: typeof value.colorLabel === "string" ? value.colorLabel : null,
    sizeLabels: Array.isArray(value.sizeLabels) ? unique(value.sizeLabels) : null, colorLabels: Array.isArray(value.colorLabels) ? unique(value.colorLabels) : null,
    stockQuantity: stock.quantity,
    skuProvided: Object.prototype.hasOwnProperty.call(value, "sku"),
    variantBarcodeProvided: Object.prototype.hasOwnProperty.call(value, "variantBarcode"),
    variantBarcode: typeof value.variantBarcode === "string" ? clean(value.variantBarcode, 200) || null : null,
    storefrontMetadata: record(value.storefrontMetadata) ? value.storefrontMetadata : null,
    variantStocks: variantStocks ?? [],
    matrixCellStocks: matrixCellStocks ?? [],
  };
}
function canWrite(claims: WorkerAuthClaims): boolean { const p = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "admin" || claims.role === "owner" || p.includes("*") || p.includes("catalog:write"); }
async function digest(raw: string): Promise<string> { const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(""); }
function id(): string { return crypto.randomUUID(); }
function revisionTimestamp(value: string | Date): number | null {
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

async function resolveMediaUrls(database: WorkerDatabaseClient, mediaIds: unknown, organizationId: string): Promise<string[] | null> {
  if (!Array.isArray(mediaIds)) return [];
  const ids = [...new Set(mediaIds.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
  if (ids.length > 100) return null;
  if (!ids.length) return [];
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) return null;
  const rows = await database.query<{ id: string; public_url: string }>(
    "SELECT id, public_url FROM public.cms_media WHERE id = ANY($1::uuid[]) AND organization_id = $2 AND deleted_at IS NULL FOR SHARE",
    [ids, organizationId],
  );
  const byId = new Map(rows.rows.map((row) => [row.id, row.public_url]));
  if (byId.size !== ids.length || ids.some((id) => !byId.get(id)?.trim())) return null;
  return ids.map((id) => byId.get(id)!.trim());
}

async function lockExistingMediaUrls(database: WorkerDatabaseClient, urls: string[], organizationId: string): Promise<boolean> {
  const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (!uniqueUrls.length) return true;
  const rows = await database.query<{ public_url: string; deleted_at: string | null }>(
    "SELECT public_url, deleted_at FROM public.cms_media WHERE organization_id = $1 AND public_url = ANY($2::text[]) FOR SHARE",
    [organizationId, uniqueUrls],
  );
  return rows.rows.every((row) => !row.deleted_at);
}

async function registerExternalMedia(database: WorkerDatabaseClient | undefined, value: ProductInput, organizationId: string): Promise<void> {
  if (!database) throw new Error("app_database_not_configured");
  const urls = [...new Set([...(value.imageUrls ?? []), ...(value.thumbnail ? [value.thumbnail] : [])])];
  for (const raw of urls) {
    let url: URL;
    try { url = new URL(raw); } catch { continue; }
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "127.0.0.1" || url.hostname === "::1") continue;
    const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "external").slice(0, 120) || "external";
    const mime = /\.jpe?g$/i.test(name) ? "image/jpeg" : /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : null;
    await database.query(
      "INSERT INTO public.cms_media AS media (organization_id,storage_path,public_url,mime_type,display_name,tags) VALUES ($1,$2,$3,$4,$5,ARRAY['catalog-product']) ON CONFLICT (organization_id,public_url) WHERE deleted_at IS NULL DO UPDATE SET tags = CASE WHEN 'catalog-product' = ANY(media.tags) THEN media.tags ELSE array_append(media.tags,'catalog-product') END",
      [organizationId, `external/${crypto.randomUUID()}`, url.href, mime, name],
    );
  }
}

async function prepareProductMedia(appDatabase: WorkerDatabaseClient, value: ProductInput, organizationId: string): Promise<Response | null> {
  if (value.storefrontMetadata && Array.isArray(value.storefrontMetadata.mediaIds)) {
    const resolved = await resolveMediaUrls(appDatabase, value.storefrontMetadata.mediaIds, organizationId);
    if (!resolved) return json({ error: "catalog_media_unavailable", code: "CATALOG_MEDIA_UNAVAILABLE" }, 400);
    value.imageUrls = resolved;
  }
  if (!await lockExistingMediaUrls(appDatabase, [...(value.imageUrls ?? []), ...(value.thumbnail ? [value.thumbnail] : [])], organizationId)) {
    return json({ error: "catalog_media_unavailable", code: "CATALOG_MEDIA_UNAVAILABLE" }, 400);
  }
  if ((value.imageUrls?.some((url) => /^https:\/\//i.test(url)) || (value.thumbnail && /^https:\/\//i.test(value.thumbnail)))) {
    await registerExternalMedia(appDatabase, value, organizationId);
  }
  return null;
}

async function saveProduct(database: WorkerDatabaseClient, appDatabase: WorkerDatabaseClient, productId: string | null, value: ProductInput, organizationId: string): Promise<Response> {
  const mediaError = await prepareProductMedia(appDatabase, value, organizationId);
  if (mediaError) return mediaError;
  const variants = pairs(value);
  const persist = async (tx: WorkerDatabaseClient) => {
    const current = productId ? (await tx.query<{ id: string; metadata: unknown; thumbnail: string | null; updated_at: string | Date }>("SELECT id, metadata, thumbnail, updated_at FROM public.product WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [productId])).rows[0] : null;
    if (productId && !current) return null;
    const handle = slug(value.handle || value.title) || `product-${Date.now()}`;
    const pid = productId ?? id();
    const currentMetadata = record(current?.metadata) ? current.metadata : {};
    const currentOrganizationId = typeof currentMetadata.organization_id === "string" ? currentMetadata.organization_id : "";
    // Unstamped legacy rows are not tenant-owned. Do not let the first caller
    // claim one implicitly; backfill ownership through an explicit migration.
    if (current && (!currentOrganizationId || currentOrganizationId !== organizationId)) return json({ error: "catalog_product_not_owned", code: "CATALOG_PRODUCT_NOT_OWNED" }, 403);
    if (current) {
      const suppliedRevision = value.expectedRevision ? revisionTimestamp(value.expectedRevision) : null;
      const currentRevision = revisionTimestamp(current.updated_at);
      if (suppliedRevision === null || currentRevision === null || suppliedRevision !== currentRevision) {
        return json({ error: "catalog_conflict", code: "CATALOG_CONFLICT" }, 409);
      }
    }
    // Preserve opaque metadata keys when the storefront-specific editor did
    // not submit a metadata object; replacement must not erase other systems'
    // product annotations.
    const metadata = { ...currentMetadata, ...(value.storefrontMetadata ?? {}) };
    if (organizationId) metadata.organization_id = organizationId;
    const thumbnail = value.imageUrls !== undefined
      ? value.imageUrls[0] ?? value.thumbnail ?? null
      : value.thumbnail ?? current?.thumbnail ?? null;
    if (!current) await tx.query("INSERT INTO public.product (id, title, handle, description, status, thumbnail, metadata, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now(),now())", [pid, value.title.trim(), handle, value.description ?? null, value.status ?? "draft", thumbnail, JSON.stringify(metadata)]);
    else await tx.query("UPDATE public.product SET title=$2, handle=$3, description=$4, status=$5, thumbnail=$6, metadata=$7::jsonb, updated_at=now() WHERE id=$1", [pid, value.title.trim(), handle, value.description ?? null, value.status ?? "draft", thumbnail, JSON.stringify(metadata)]);
    const shipping = (await tx.query<{ id: string }>("SELECT id FROM public.shipping_profile WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1")).rows[0];
    if (!shipping) throw new Error("shipping_profile_not_configured");
    await tx.query("INSERT INTO public.product_shipping_profile (product_id, shipping_profile_id, id) VALUES ($1,$2,$3) ON CONFLICT (product_id, shipping_profile_id) DO UPDATE SET deleted_at=NULL, updated_at=now()", [pid, shipping.id, id()]);
    await tx.query("UPDATE public.product_shipping_profile SET deleted_at=now(), updated_at=now() WHERE product_id=$1 AND deleted_at IS NULL AND shipping_profile_id <> $2", [pid, shipping.id]);
    if (value.categoryIds !== undefined) {
      await tx.query("DELETE FROM public.product_category_product WHERE product_id=$1", [pid]);
      for (const categoryId of value.categoryIds) {
        await tx.query("INSERT INTO public.product_category_product (product_id, product_category_id) SELECT $1,id FROM public.product_category WHERE id=$2 AND deleted_at IS NULL ON CONFLICT DO NOTHING", [pid, categoryId]);
        const exists = await tx.query<{ id: string }>("SELECT id FROM public.product_category WHERE id=$1 AND deleted_at IS NULL", [categoryId]);
        if (!exists.rows[0]) throw new Error("catalog_category_not_found");
      }
    }
    if (value.imageUrls !== undefined || value.thumbnail !== undefined) {
      await tx.query("UPDATE public.image SET deleted_at=now(), updated_at=now() WHERE product_id=$1 AND deleted_at IS NULL", [pid]);
      for (const [rank, url] of (value.imageUrls ?? (value.thumbnail ? [value.thumbnail] : [])).entries()) await tx.query("INSERT INTO public.image (id,url,rank,product_id,created_at,updated_at) VALUES ($1,$2,$3,$4,now(),now())", [id(), url, rank, pid]);
    }
    // The product row lock serializes all mutations to this variant graph.
    // Lock variants separately; PostgreSQL rejects FOR UPDATE on this grouped projection.
    await tx.query("SELECT id FROM public.product_variant WHERE product_id=$1 AND deleted_at IS NULL FOR UPDATE", [pid]);
    const existing = await tx.query<{ id: string; sku: string | null; barcode: string | null; size: string | null; color: string | null }>(`SELECT v.id, v.sku, v.barcode,
        MAX(CASE WHEN lower(po.title)='size' THEN pov.value END) AS size,
        MAX(CASE WHEN lower(po.title)='color' THEN pov.value END) AS color
        FROM public.product_variant v
        LEFT JOIN public.product_variant_option pvo ON pvo.variant_id=v.id
        LEFT JOIN public.product_option_value pov ON pov.id=pvo.option_value_id AND pov.deleted_at IS NULL
        LEFT JOIN public.product_option po ON po.id=pov.option_id AND po.deleted_at IS NULL
        WHERE v.product_id=$1 AND v.deleted_at IS NULL
        GROUP BY v.id ORDER BY v.variant_rank,v.id`, [pid]);
    const existingVariantIds = new Set(existing.rows.map((row) => row.id));
    if ((value.variantStocks ?? []).some((stock) => !existingVariantIds.has(stock.variantId))) {
      throw new Error("catalog_variant_stock_not_owned");
    }
    const existingByPair = new Map(existing.rows.filter((row) => row.size && row.color).map((row) => [`${row.size}\u0000${row.color}`, row]));
    const keep = new Set<string>();
    const optionIds: Record<string, string> = {};
    for (const title of ["Size", "Color"]) {
      const existingOption = (await tx.query<{ id: string }>(
        `SELECT po.id
           FROM public.product_option po
           JOIN public.product_product_option ppo
             ON ppo.product_option_id = po.id
            AND ppo.product_id = $1
            AND ppo.deleted_at IS NULL
          WHERE po.title = $2 AND po.deleted_at IS NULL
          LIMIT 1`,
        [pid, title],
      )).rows[0];
      const option = existingOption
        ? existingOption
        : (await tx.query<{ id: string }>(
          "INSERT INTO public.product_option (id,title,created_at,updated_at) VALUES ($1,$2,now(),now()) RETURNING id",
          [id(), title],
        )).rows[0];
      if (!existingOption) {
        await tx.query(
          "INSERT INTO public.product_product_option (id,product_id,product_option_id,created_at,updated_at) VALUES ($1,$2,$3,now(),now())",
          [id(), pid, option.id],
        );
      }
      optionIds[title] = option.id;
      const values = title === "Size" ? unique(variants.map((v) => v.size)) : unique(variants.map((v) => v.color));
      await tx.query("UPDATE public.product_option_value SET deleted_at=now(),updated_at=now() WHERE option_id=$1 AND deleted_at IS NULL AND NOT (value = ANY($2::text[]))", [option.id, values]);
      for (const val of values) {
        const row = await tx.query<{ id: string }>("INSERT INTO public.product_option_value (id,value,option_id,created_at,updated_at) VALUES ($1,$2,$3,now(),now()) ON CONFLICT (option_id,value) WHERE deleted_at IS NULL DO UPDATE SET updated_at=now() RETURNING id", [id(), val, option.id]);
        if (row.rows[0]) optionIds[`${title}:${val}`] = row.rows[0].id;
      }
    }
    const stockById = new Map((value.variantStocks ?? []).map((v) => [v.variantId, v.quantity]));
    const matrixStocks = new Map((value.matrixCellStocks ?? []).map((v) => [`${v.sizeLabel}\u0000${v.colorLabel}`, v.quantity]));
    for (const [rank, pair] of variants.entries()) {
      const old = existingByPair.get(`${pair.size}\u0000${pair.color}`); const vid = old?.id ?? id(); keep.add(vid);
      const sku = variants.length === 1 && value.skuProvided ? value.sku ?? null : old?.sku ?? null;
      const barcode = variants.length === 1 && value.variantBarcodeProvided ? value.variantBarcode ?? null : old?.barcode ?? null;
      await tx.query("INSERT INTO public.product_variant (id,title,sku,barcode,product_id,manage_inventory,variant_rank,created_at,updated_at,deleted_at) VALUES ($1,$2,$3,$4,$5,true,$6,now(),now(),NULL) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, sku=EXCLUDED.sku, barcode=EXCLUDED.barcode, variant_rank=EXCLUDED.variant_rank, updated_at=now(), deleted_at=NULL", [vid, `${pair.size} / ${pair.color}`, sku, barcode, pid, rank]);
      await tx.query("DELETE FROM public.product_variant_option WHERE variant_id=$1", [vid]);
      await tx.query("INSERT INTO public.product_variant_option (variant_id,option_value_id) VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING", [vid, optionIds[`Size:${pair.size}`], optionIds[`Color:${pair.color}`]]);
      const linkedPrice = (await tx.query<{ price_set_id: string }>("SELECT price_set_id FROM public.product_variant_price_set WHERE variant_id=$1 AND deleted_at IS NULL LIMIT 1", [vid])).rows[0];
      const ps = linkedPrice?.price_set_id ?? (await tx.query<{ id: string }>("INSERT INTO public.price_set (id,created_at,updated_at) VALUES ($1,now(),now()) RETURNING id", [id()])).rows[0].id;
      if (!linkedPrice) await tx.query("INSERT INTO public.product_variant_price_set (variant_id,price_set_id,id,created_at,updated_at) VALUES ($1,$2,$3,now(),now())", [vid, ps, id()]);
      const currentPrice = (await tx.query<{ id: string }>("SELECT id FROM public.price WHERE price_set_id=$1 AND currency_code='php' AND deleted_at IS NULL ORDER BY created_at LIMIT 1", [ps])).rows[0];
      if (currentPrice) await tx.query("UPDATE public.price SET amount=$2, raw_amount=$3::jsonb, currency_code='php', updated_at=now() WHERE id=$1", [currentPrice.id, amount(value.pricePhp), JSON.stringify({ value: amount(value.pricePhp), currency_code: "php" })]);
      else await tx.query("INSERT INTO public.price (id,price_set_id,currency_code,raw_amount,amount,created_at,updated_at) VALUES ($1,$2,'php',$3::jsonb,$4,now(),now())", [id(), ps, JSON.stringify({ value: amount(value.pricePhp), currency_code: "php" }), amount(value.pricePhp)]);
      const linkedInventory = (await tx.query<{ inventory_item_id: string }>("SELECT inventory_item_id FROM public.product_variant_inventory_item WHERE variant_id=$1 AND deleted_at IS NULL LIMIT 1", [vid])).rows[0];
      const inv = linkedInventory?.inventory_item_id ?? (await tx.query<{ id: string }>("INSERT INTO public.inventory_item (id,sku,title,created_at,updated_at) VALUES ($1,$2,$3,now(),now()) RETURNING id", [id(), variants.length === 1 ? value.sku : null, `${value.title} ${pair.size} ${pair.color}`])).rows[0].id;
      if (!linkedInventory) await tx.query("INSERT INTO public.product_variant_inventory_item (variant_id,inventory_item_id,id,created_at,updated_at) VALUES ($1,$2,$3,now(),now())", [vid, inv, id()]);
      else await tx.query("UPDATE public.inventory_item SET sku=$2,title=$3,updated_at=now() WHERE id=$1", [inv, sku, `${value.title} ${pair.size} ${pair.color}`]);
      const locations = (await tx.query<{ id: string }>("SELECT id FROM public.stock_location WHERE deleted_at IS NULL ORDER BY created_at")).rows;
      const requestedStock = matrixStocks.get(`${pair.size}\u0000${pair.color}`) ?? stockById.get(vid) ?? value.stockQuantity;
      if (requestedStock !== undefined && locations.length === 0) throw new Error("stock_location_not_configured");
      // A product-level quantity is a total, not a per-location multiplier.
      // Allocate it deterministically so aggregate availability cannot be
      // inflated when more than one location exists.
      const allocations = requestedStock === undefined
        ? locations.map(() => undefined)
      : locations.map((_, index) => Math.floor(requestedStock / locations.length) + (index < requestedStock % locations.length ? 1 : 0));
      for (const [index, location] of locations.entries()) {
        const existingLevel = (await tx.query<{ stocked_quantity: number; reserved_quantity: number }>("SELECT stocked_quantity,reserved_quantity FROM public.inventory_level WHERE inventory_item_id=$1 AND location_id=$2 AND deleted_at IS NULL FOR UPDATE", [inv, location.id])).rows[0];
        const stocked = allocations[index] ?? existingLevel?.stocked_quantity ?? 0;
        if (stocked < Number(existingLevel?.reserved_quantity ?? 0)) throw new Error("stock_below_reserved_quantity");
        await tx.query("INSERT INTO public.inventory_level (id,inventory_item_id,location_id,stocked_quantity,reserved_quantity,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,now(),now()) ON CONFLICT (inventory_item_id,location_id) WHERE deleted_at IS NULL DO UPDATE SET stocked_quantity=EXCLUDED.stocked_quantity, updated_at=now()", [id(), inv, location.id, stocked, existingLevel?.reserved_quantity ?? 0]);
      }
    }
    if (existing.rows.length) await tx.query("UPDATE public.product_variant SET deleted_at=now(),updated_at=now() WHERE product_id=$1 AND deleted_at IS NULL AND NOT (id = ANY($2::text[]))", [pid, [...keep]]);
    return { id: pid };
  };
  const product = await persist(database);
  if (!product) return json({ error: "not_found" }, 404);
  if (product instanceof Response) return product;
  return json({ productId: product.id }, productId ? 200 : 201);
}

export async function handleAdminCatalogProductMutationRequest(request: Request, database: WorkerDatabaseClient, env: Env, productId?: string, appDatabase?: WorkerDatabaseClient): Promise<Response> {
  if (request.method !== "POST" && request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !canWrite(claims)) return json({ error: "unauthorized" }, 401);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text(); if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_product_payload" }, 400); }
  const parsed = input(value); if (!parsed) return json({ error: "invalid_product_payload" }, 400);
  const variants = pairs(parsed);
  if (!parsed.title.trim() || !variants.length) return json({ error: "invalid_product_payload" }, 400);
  const variantPairs = new Set(variants.map((variant) => `${variant.size}\u0000${variant.color}`));
  if ((parsed.matrixCellStocks ?? []).some((stock) => !variantPairs.has(`${stock.sizeLabel}\u0000${stock.colorLabel}`))) {
    return json({ error: "invalid_product_payload" }, 400);
  }
  const organizationClaim = claims.organization_id ?? claims.org_id;
  const organizationId = typeof organizationClaim === "string" ? organizationClaim.trim() : "";
  if (!organizationId) return json({ error: "organization_scope_required", code: "ORGANIZATION_SCOPE_REQUIRED" }, 403);
  const actorId = typeof claims.sub === "string" ? claims.sub : "";
  if (!actorId) return json({ error: "staff_subject_required" }, 403);
  if (!appDatabase) return json({ error: "app_database_not_configured" }, 503);
  try {
    const requestHash = await digest(raw);
    const result = await withWorkerTransaction(appDatabase, async (appTransaction) => {
      const mutation = await withWorkerTransaction(database, (commerceTransaction) =>
        executeIdempotently(
          new HyperdriveIdempotencyStore(commerceTransaction),
          key,
          requestHash,
          () => saveProduct(commerceTransaction, appTransaction, productId ?? null, parsed, organizationId),
        ),
      );
      // If APP commit failed after the commerce transaction committed, retry
      // replays the commerce response. Rebuild the APP media projection before
      // returning that replay so reference/deletion state cannot drift.
      if (mutation.kind === "replayed" && mutation.response.ok) {
        const mediaError = await prepareProductMedia(appTransaction, parsed, organizationId);
        if (mediaError) throw new Error("catalog_media_recovery_failed");
      }
      return mutation;
    });
    if (!result.response.ok) return result.response;
    const saved = await result.response.clone().json() as { productId?: unknown };
    if (typeof saved.productId !== "string" || !saved.productId) return json({ error: "catalog_mutation_response_invalid" }, 502);
    const appKey = `catalog-product-finalize:${await digest(JSON.stringify({ organizationId, actorId, key }))}`;
    const appRequestHash = await digest(JSON.stringify({ operation: productId ? "update" : "create", productId: saved.productId, requestHash: await digest(raw), organizationId, actorId }));
    const finalized = await withWorkerTransaction(appDatabase, (transaction) => executeIdempotently(
      new HyperdriveIdempotencyStore(transaction),
      appKey,
      appRequestHash,
      async () => {
        await transaction.query(
          "INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)",
          [productId ? "catalog.product.update" : "catalog.product.create", `product:${saved.productId}`, JSON.stringify({ organization_id: organizationId, actor_subject: actorId, title: parsed.title.trim() })],
        );
        return json({ productId: saved.productId }, productId ? 200 : 201);
      },
    ));
    return finalized.response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "catalog_mutation_failed";
    if (message === "app_database_not_configured") return json({ error: message }, 503);
    if (message === "catalog_media_recovery_failed") return json({ error: "catalog_media_recovery_unavailable", code: "CATALOG_MEDIA_RECOVERY_UNAVAILABLE" }, 503);
    if (message === "catalog_category_not_found") return json({ error: message, code: "CATALOG_CATEGORY_NOT_FOUND" }, 400);
    if (message === "stock_location_not_configured" || message === "stock_below_reserved_quantity") {
      return json({ error: message, code: message === "stock_location_not_configured" ? "STOCK_LOCATION_NOT_CONFIGURED" : "STOCK_BELOW_RESERVED_QUANTITY" }, 409);
    }
    if (message === "catalog_variant_stock_not_owned") return json({ error: "catalog_variant_stock_not_owned", code: "CATALOG_VARIANT_STOCK_NOT_OWNED" }, 400);
    if (message === "shipping_profile_not_configured") return json({ error: message, code: "SHIPPING_PROFILE_NOT_CONFIGURED" }, 503);
    if (record(error) && error.code === "23505") return json({ error: "catalog_handle_exists", code: "CATALOG_HANDLE_EXISTS" }, 409);
    // Provider/database details are for server diagnostics only. The client
    // receives a stable contract even when an unexpected dependency fails.
    return json({ error: "catalog_mutation_unavailable", code: "CATALOG_MUTATION_UNAVAILABLE" }, 503);
  }
}
