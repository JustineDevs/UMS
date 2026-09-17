import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string };
type OptionInput = { size: string; color: string };
type ProductInput = {
  expectedRevision?: string;
  title: string; handle?: string; description?: string | null;
  status?: "draft" | "published"; pricePhp: number; sku?: string | null;
  imageUrls?: string[]; thumbnail?: string | null; categoryIds?: string[];
  sizeLabel?: string | null; colorLabel?: string | null;
  sizeLabels?: string[] | null; colorLabels?: string[] | null;
  stockQuantity?: number; variantBarcode?: string | null;
  storefrontMetadata?: Record<string, unknown> | null;
  variantStocks?: Array<{ variantId: string; quantity: number }>;
  matrixCellStocks?: Array<{ sizeLabel: string; colorLabel: string; quantity: number }>;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function clean(value: unknown, max = 200): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200); }
function unique(values: unknown[], max = 40): string[] { return [...new Set(values.filter((v): v is string => typeof v === "string").map((v) => v.trim().slice(0, 100)).filter(Boolean))].slice(0, max); }
function amount(value: number): number { return Math.round(value * 100); }
function pairs(input: ProductInput): OptionInput[] {
  const sizes = unique(input.sizeLabels ?? (input.sizeLabel ? [input.sizeLabel] : ["One Size"]));
  const colors = unique(input.colorLabels ?? (input.colorLabel ? [input.colorLabel] : ["Default"]));
  if (!sizes.length || !colors.length || sizes.length * colors.length > 80) return [];
  return sizes.flatMap((size) => colors.map((color) => ({ size, color })));
}
function input(value: unknown): ProductInput | null {
  if (!record(value) || typeof value.title !== "string" || typeof value.pricePhp !== "number" || !Number.isFinite(value.pricePhp) || value.pricePhp < 0) return null;
  const imageUrls = Array.isArray(value.imageUrls) ? value.imageUrls.filter((v): v is string => typeof v === "string" && /^(https?:\/\/|\/)/i.test(v)).map((v) => v.trim()).slice(0, 100) : undefined;
  const categories = Array.isArray(value.categoryIds) ? unique(value.categoryIds, 100) : undefined;
  return {
    expectedRevision: clean(value.expected_revision ?? value.expectedRevision, 100) || undefined,
    title: clean(value.title, 500), handle: clean(value.handle, 200), description: typeof value.description === "string" ? value.description.slice(0, 10000) : null,
    status: value.status === "published" ? "published" : "draft", pricePhp: value.pricePhp, sku: typeof value.sku === "string" ? clean(value.sku, 200) || null : null,
    imageUrls, thumbnail: typeof value.thumbnail === "string" ? clean(value.thumbnail, 8000) || null : undefined, categoryIds: categories,
    sizeLabel: typeof value.sizeLabel === "string" ? value.sizeLabel : null, colorLabel: typeof value.colorLabel === "string" ? value.colorLabel : null,
    sizeLabels: Array.isArray(value.sizeLabels) ? unique(value.sizeLabels) : null, colorLabels: Array.isArray(value.colorLabels) ? unique(value.colorLabels) : null,
    stockQuantity: typeof value.stockQuantity === "number" && Number.isSafeInteger(value.stockQuantity) && value.stockQuantity >= 0 ? value.stockQuantity : undefined,
    variantBarcode: typeof value.variantBarcode === "string" ? clean(value.variantBarcode, 200) || null : null,
    storefrontMetadata: record(value.storefrontMetadata) ? value.storefrontMetadata : null,
    variantStocks: Array.isArray(value.variantStocks) ? value.variantStocks.filter(record).map((v) => ({ variantId: clean(v.variantId), quantity: Number(v.quantity) })).filter((v) => v.variantId && Number.isSafeInteger(v.quantity) && v.quantity >= 0) : [],
    matrixCellStocks: Array.isArray(value.matrixCellStocks) ? value.matrixCellStocks.filter(record).map((v) => ({ sizeLabel: clean(v.sizeLabel, 100), colorLabel: clean(v.colorLabel, 100), quantity: Number(v.quantity) })).filter((v) => v.sizeLabel && v.colorLabel && Number.isSafeInteger(v.quantity) && v.quantity >= 0) : [],
  };
}
function canWrite(claims: WorkerAuthClaims): boolean { const p = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "admin" || claims.role === "owner" || p.includes("*") || p.includes("catalog:write"); }
async function authorize(request: Request, env: Env): Promise<boolean> { const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL }); return Boolean(claims && canWrite(claims)); }
async function digest(raw: string): Promise<string> { const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(""); }
function id(): string { return crypto.randomUUID(); }

async function saveProduct(database: WorkerDatabaseClient, productId: string | null, value: ProductInput): Promise<Response> {
  const variants = pairs(value);
  if (!value.title.trim() || !variants.length) return json({ error: "invalid_product_payload" }, 400);
  const product = await withWorkerTransaction(database, async (tx) => {
    const current = productId ? (await tx.query<{ id: string; metadata: unknown; thumbnail: string | null; updated_at: string }>("SELECT id, metadata, thumbnail, updated_at FROM public.product WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [productId])).rows[0] : null;
    if (productId && !current) return null;
    if (current && value.expectedRevision && current.updated_at !== value.expectedRevision) return json({ error: "catalog_conflict", code: "CATALOG_CONFLICT" }, 409);
    const handle = slug(value.handle || value.title) || `product-${Date.now()}`;
    const pid = productId ?? id();
    const currentMetadata = record(current?.metadata) ? current.metadata : {};
    const metadata = value.storefrontMetadata === null ? {} : { ...currentMetadata, ...(value.storefrontMetadata ?? {}) };
    const thumbnail = value.imageUrls?.[0] ?? value.thumbnail ?? current?.thumbnail ?? null;
    if (!current) await tx.query("INSERT INTO public.product (id, title, handle, description, status, thumbnail, metadata, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now(),now())", [pid, value.title.trim(), handle, value.description ?? null, value.status ?? "draft", thumbnail, JSON.stringify(metadata)]);
    else await tx.query("UPDATE public.product SET title=$2, handle=$3, description=$4, status=$5, thumbnail=$6, metadata=$7::jsonb, updated_at=now() WHERE id=$1", [pid, value.title.trim(), handle, value.description ?? null, value.status ?? "draft", thumbnail, JSON.stringify(metadata)]);
    const shipping = (await tx.query<{ id: string }>("SELECT id FROM public.shipping_profile WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1")).rows[0];
    if (!shipping) throw new Error("shipping_profile_not_configured");
    await tx.query("INSERT INTO public.product_shipping_profile (product_id, shipping_profile_id, id) VALUES ($1,$2,$3) ON CONFLICT (product_id, shipping_profile_id) DO UPDATE SET deleted_at=NULL, updated_at=now()", [pid, shipping.id, id()]);
    await tx.query("UPDATE public.product_shipping_profile SET deleted_at=now(), updated_at=now() WHERE product_id=$1 AND deleted_at IS NULL AND shipping_profile_id <> $2", [pid, shipping.id]);
    if (value.categoryIds !== undefined) {
      await tx.query("DELETE FROM public.product_category_product WHERE product_id=$1", [pid]);
      for (const categoryId of value.categoryIds) await tx.query("INSERT INTO public.product_category_product (product_id, product_category_id) SELECT $1,id FROM public.product_category WHERE id=$2 AND deleted_at IS NULL ON CONFLICT DO NOTHING", [pid, categoryId]);
    }
    if (value.imageUrls !== undefined || value.thumbnail !== undefined) {
      await tx.query("UPDATE public.image SET deleted_at=now(), updated_at=now() WHERE product_id=$1 AND deleted_at IS NULL", [pid]);
      for (const [rank, url] of (value.imageUrls ?? (value.thumbnail ? [value.thumbnail] : [])).entries()) await tx.query("INSERT INTO public.image (id,url,rank,product_id,created_at,updated_at) VALUES ($1,$2,$3,$4,now(),now())", [id(), url, rank, pid]);
    }
    const existing = await tx.query<{ id: string; sku: string | null; size: string | null; color: string | null }>(`SELECT v.id, v.sku,
        MAX(CASE WHEN lower(po.title)='size' THEN pov.value END) AS size,
        MAX(CASE WHEN lower(po.title)='color' THEN pov.value END) AS color
        FROM public.product_variant v
        LEFT JOIN public.product_variant_option pvo ON pvo.variant_id=v.id
        LEFT JOIN public.product_option_value pov ON pov.id=pvo.option_value_id AND pov.deleted_at IS NULL
        LEFT JOIN public.product_option po ON po.id=pov.option_id AND po.deleted_at IS NULL
        WHERE v.product_id=$1 AND v.deleted_at IS NULL
        GROUP BY v.id ORDER BY v.variant_rank,v.id FOR UPDATE`, [pid]);
    const existingByPair = new Map(existing.rows.filter((row) => row.size && row.color).map((row) => [`${row.size}\u0000${row.color}`, row]));
    const keep = new Set<string>();
    const optionIds: Record<string, string> = {};
    for (const title of ["Size", "Color"]) {
      const option = (await tx.query<{ id: string }>("INSERT INTO public.product_option (id,title,product_id,created_at,updated_at) VALUES ($1,$2,$3,now(),now()) ON CONFLICT (product_id,title) WHERE deleted_at IS NULL DO UPDATE SET updated_at=now() RETURNING id", [id(), title, pid])).rows[0];
      optionIds[title] = option.id;
      const values = title === "Size" ? unique(variants.map((v) => v.size)) : unique(variants.map((v) => v.color));
      await tx.query("UPDATE public.product_option_value SET deleted_at=now(),updated_at=now() WHERE option_id=$1 AND deleted_at IS NULL AND NOT (value = ANY($2::text[]))", [option.id, values]);
      for (const val of values) { const row = await tx.query<{ id: string }>("INSERT INTO public.product_option_value (id,value,option_id,created_at,updated_at) VALUES ($1,$2,$3,now(),now()) ON CONFLICT (option_id,value) WHERE deleted_at IS NULL DO UPDATE SET updated_at=now() RETURNING id", [id(), val, option.id]); if (row.rows[0]) optionIds[`${title}:${val}`] = row.rows[0].id; }
    }
    const stockById = new Map((value.variantStocks ?? []).map((v) => [v.variantId, v.quantity]));
    const matrixStocks = new Map((value.matrixCellStocks ?? []).map((v) => [`${v.sizeLabel}\u0000${v.colorLabel}`, v.quantity]));
    for (const [rank, pair] of variants.entries()) {
      const old = existingByPair.get(`${pair.size}\u0000${pair.color}`) ?? existing.rows[rank]; const vid = old?.id ?? id(); keep.add(vid);
      await tx.query("INSERT INTO public.product_variant (id,title,sku,barcode,product_id,manage_inventory,variant_rank,created_at,updated_at,deleted_at) VALUES ($1,$2,$3,$4,$5,true,$6,now(),now(),NULL) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, sku=EXCLUDED.sku, barcode=EXCLUDED.barcode, variant_rank=EXCLUDED.variant_rank, updated_at=now(), deleted_at=NULL", [vid, `${pair.size} / ${pair.color}`, variants.length === 1 ? value.sku : null, variants.length === 1 ? value.variantBarcode : null, pid, rank]);
      await tx.query("DELETE FROM public.product_variant_option WHERE variant_id=$1", [vid]);
      await tx.query("INSERT INTO public.product_variant_option (variant_id,option_value_id) VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING", [vid, optionIds[`Size:${pair.size}`], optionIds[`Color:${pair.color}`]]);
      const linkedPrice = (await tx.query<{ price_set_id: string }>("SELECT price_set_id FROM public.product_variant_price_set WHERE variant_id=$1 AND deleted_at IS NULL LIMIT 1", [vid])).rows[0];
      const ps = linkedPrice?.price_set_id ?? (await tx.query<{ id: string }>("INSERT INTO public.price_set (id,created_at,updated_at) VALUES ($1,now(),now()) RETURNING id", [id()])).rows[0].id;
      if (!linkedPrice) await tx.query("INSERT INTO public.product_variant_price_set (variant_id,price_set_id,id,created_at,updated_at) VALUES ($1,$2,$3,now(),now())", [vid, ps, id()]);
      const currentPrice = (await tx.query<{ id: string }>("SELECT id FROM public.price WHERE price_set_id=$1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1", [ps])).rows[0];
      if (currentPrice) await tx.query("UPDATE public.price SET amount=$2, raw_amount=$3::jsonb, currency_code='php', updated_at=now() WHERE id=$1", [currentPrice.id, amount(value.pricePhp), JSON.stringify({ value: amount(value.pricePhp), currency_code: "php" })]);
      else await tx.query("INSERT INTO public.price (id,price_set_id,currency_code,raw_amount,amount,created_at,updated_at) VALUES ($1,$2,'php',$3::jsonb,$4,now(),now())", [id(), ps, JSON.stringify({ value: amount(value.pricePhp), currency_code: "php" }), amount(value.pricePhp)]);
      const linkedInventory = (await tx.query<{ inventory_item_id: string }>("SELECT inventory_item_id FROM public.product_variant_inventory_item WHERE variant_id=$1 AND deleted_at IS NULL LIMIT 1", [vid])).rows[0];
      const inv = linkedInventory?.inventory_item_id ?? (await tx.query<{ id: string }>("INSERT INTO public.inventory_item (id,sku,title,created_at,updated_at) VALUES ($1,$2,$3,now(),now()) RETURNING id", [id(), variants.length === 1 ? value.sku : null, `${value.title} ${pair.size} ${pair.color}`])).rows[0].id;
      if (!linkedInventory) await tx.query("INSERT INTO public.product_variant_inventory_item (variant_id,inventory_item_id,id,created_at,updated_at) VALUES ($1,$2,$3,now(),now())", [vid, inv, id()]);
      const location = (await tx.query<{ id: string }>("SELECT id FROM public.stock_location WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1")).rows[0];
      if (location) {
        const existingLevel = (await tx.query<{ stocked_quantity: number; reserved_quantity: number }>("SELECT stocked_quantity,reserved_quantity FROM public.inventory_level WHERE inventory_item_id=$1 AND location_id=$2 AND deleted_at IS NULL FOR UPDATE", [inv, location.id])).rows[0];
        const requestedStock = matrixStocks.get(`${pair.size}\u0000${pair.color}`) ?? stockById.get(vid) ?? value.stockQuantity;
        const stocked = requestedStock ?? existingLevel?.stocked_quantity ?? 0;
        await tx.query("INSERT INTO public.inventory_level (id,inventory_item_id,location_id,stocked_quantity,reserved_quantity,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,now(),now()) ON CONFLICT (inventory_item_id,location_id) WHERE deleted_at IS NULL DO UPDATE SET stocked_quantity=EXCLUDED.stocked_quantity, updated_at=now()", [id(), inv, location.id, stocked, existingLevel?.reserved_quantity ?? 0]);
      }
    }
    if (existing.rows.length) await tx.query("UPDATE public.product_variant SET deleted_at=now(),updated_at=now() WHERE product_id=$1 AND deleted_at IS NULL AND NOT (id = ANY($2::text[]))", [pid, [...keep]]);
    return { id: pid };
  });
  if (!product) return json({ error: "not_found" }, 404);
  if (product instanceof Response) return product;
  return json({ productId: product.id }, productId ? 200 : 201);
}

export async function handleAdminCatalogProductMutationRequest(request: Request, database: WorkerDatabaseClient, env: Env, productId?: string): Promise<Response> {
  if (request.method !== "POST" && request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  if (!(await authorize(request, env))) return json({ error: "unauthorized" }, 401);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text(); if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_product_payload" }, 400); }
  const parsed = input(value); if (!parsed) return json({ error: "invalid_product_payload" }, 400);
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await digest(raw), () => saveProduct(database, productId ?? null, parsed));
  return result.response;
}
