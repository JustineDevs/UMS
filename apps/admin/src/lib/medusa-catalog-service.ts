/**
 * Catalog types and server helpers for in-app product editor.
 * Commerce writes go through Medusa Admin API via {@link @/lib/medusa-pos#getMedusaAdminSdk}.
 */

import { getMedusaAdminSdk, getMedusaRegionId, optionRowsToSizeColor } from "@/lib/medusa-pos";
import { createHash } from "node:crypto";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { fetchVariantStockedQuantity } from "@/lib/medusa-catalog-inventory-stock";
import {
  catalogMetadataFromMedusa,
  type CatalogProductMetadataFields,
} from "@/lib/catalog-product-metadata";

/** Per-variant stocked units for the matrix stock editor (edit mode). */
export type CatalogVariantStockRow = {
  variantId: string;
  /** Size option value (trimmed) for matrix filtering. */
  sizeLabel: string;
  /** Color option value (trimmed) for matrix filtering. */
  colorLabel: string;
  /** Display label, e.g. "M / Black". */
  label: string;
  /** Stocked quantity from Medusa inventory levels; null if the request failed. */
  stockedQuantity: number | null;
};

export type CatalogProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  status: string;
  thumbnail: string | null;
  /** Medusa product image URLs in gallery order. */
  imageUrls: string[];
  variantCount: number;
  /** First variant id when exactly one variant (simple products). */
  variantId: string | null;
  sku: string | null;
  /** Display pesos (major units); derived from first variant PHP price. */
  pricePhp: number | null;
  /** ISO currency for label (store default region). */
  currencyCode: string;
  /** Medusa category ids (shop category filter + PDP). */
  categoryIds: string[];
  /** Category handles for storefront `collection:{handle}` cache tags. */
  categoryHandles: string[];
  /** Display names for selected categories. */
  categoryLabels: string[];
  /** First variant Size option (shop size filter). */
  sizeLabel: string;
  /** First variant Color option (shop color filter). */
  colorLabel: string;
  /** Unique size values across variants (matrix editor seed). */
  matrixSizes: string[];
  /** Unique color values across variants (matrix editor seed). */
  matrixColors: string[];
  /**
   * True when options include both Size and Color (matches storefront mapper).
   * Legacy single "Default" products are false until edited in Medusa or recreated.
   */
  shopVariantOptionsReady: boolean;
  /**
   * Stocked quantity for a simple product (one variant). Null when multiple variants
   * or when inventory could not be read.
   */
  stockQuantity: number | null;
  /** All variants with stocked counts for per-row editing (edit screen). */
  variantStockRows: CatalogVariantStockRow[];
  /** Medusa variant barcode when loaded. */
  variantBarcode: string | null;
  /** Storefront-facing metadata (same keys as storefront mapper). */
  storefrontMetadata: CatalogProductMetadataFields;
  /** Optional variant rows for tooling or future admin UI. */
  variantSummaries?: Array<{ id: string; sku: string | null; title?: string }>;
  /**
   * Sorted join of variant id + sell price minor amount in default region currency (mutation classification).
   */
  variantSellPriceSignature: string;
  /**
   * Sorted join of variant id + compare-at metadata (e.g. legacy_compare_at_price_minor), or "none".
   */
  variantCompareAtSignature: string;
  /** Title, description, thumbnail, images — editorial merchandising surface without sell price. */
  editorialSurfaceSignature: string;
  /** Stable string for non-price storefront metadata (brand, SEO, related, hotspots, etc.). */
  storefrontMetadataSignature: string;
  /** Hash of the loaded editable state used for optimistic concurrency. */
  revision?: string;
};

/** PHP amount in minor units (centavos) for Medusa `prices[].amount`. */
export function phpPesosToMinorUnits(pesos: number): number {
  if (!Number.isFinite(pesos) || pesos < 0) return 0;
  return Math.round(pesos * 100);
}

export function phpMinorUnitsToPesos(minor: number): number {
  if (!Number.isFinite(minor)) return 0;
  return minor / 100;
}

function uniqueOptionValuesPreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function buildVariantSellPriceSignature(
  variants: Array<{
    id?: string;
    prices?: Array<{ amount?: number; currency_code?: string | null }>;
  }>,
  currencyCodeResolved: string,
): string {
  const cur = currencyCodeResolved.toLowerCase();
  const parts: string[] = [];
  for (const v of variants) {
    const vid = v?.id != null ? String(v.id) : "";
    if (!vid) continue;
    const prices = v.prices ?? [];
    const priceRow =
      prices.find((p) => (p.currency_code ?? "").toLowerCase() === cur) ??
      prices.find((p) => (p.currency_code ?? "").toLowerCase() === "php") ??
      prices[0];
    const amt =
      priceRow && typeof priceRow.amount === "number" ? priceRow.amount : -1;
    parts.push(`${vid}:${amt}`);
  }
  return parts.sort().join("|");
}

function buildVariantCompareAtSignature(
  variants: Array<{ id?: string; metadata?: Record<string, unknown> | null }>,
): string {
  const parts: string[] = [];
  for (const v of variants) {
    const vid = v?.id != null ? String(v.id) : "";
    if (!vid) continue;
    const meta =
      v.metadata && typeof v.metadata === "object" ? v.metadata : {};
    const raw = meta["legacy_compare_at_price_minor"];
    const val =
      typeof raw === "number" && Number.isFinite(raw)
        ? String(Math.round(raw))
        : typeof raw === "string" && raw.trim()
          ? raw.trim()
          : "none";
    parts.push(`${vid}:${val}`);
  }
  return parts.sort().join("|");
}

function buildEditorialSurfaceSignature(input: {
  title: string;
  description: string | null;
  thumbnail: string | null;
  imageUrls: string[];
}): string {
  return [
    input.title.trim(),
    (input.description ?? "").trim(),
    (input.thumbnail ?? "").trim(),
    input.imageUrls.join(","),
  ].join("\u0001");
}

function buildStorefrontMetadataSignature(
  m: CatalogProductMetadataFields,
): string {
  return JSON.stringify({
    brand: m.brand,
    videoUrl: m.videoUrl,
    galleryVideoUrlsText: m.galleryVideoUrlsText,
    weightKg: m.weightKg,
    dimensionsLabel: m.dimensionsLabel,
    material: m.material,
    lifestyleImageUrl: m.lifestyleImageUrl,
    seoDescription: m.seoDescription,
    relatedHandlesText: m.relatedHandlesText,
    hotspotsJson: m.hotspotsJson,
  });
}

/**
 * Region default currency for Admin price rows (matches Medusa region, same as storefront region).
 */
export async function getCatalogPriceCurrencyCode(): Promise<string> {
  const regionId = getMedusaRegionId();
  if (!regionId) return "php";
  const res = await medusaAdminFetch(
    `/admin/regions/${encodeURIComponent(regionId)}?fields=currency_code`,
  );
  if (!res.ok) return "php";
  const j = (await res.json()) as { region?: { currency_code?: string } };
  const code = j.region?.currency_code;
  return typeof code === "string" && code.trim()
    ? code.trim().toLowerCase()
    : "php";
}

/**
 * Load product detail for in-app edit (size × color matrix, metadata, stock).
 */
export async function fetchCatalogProductDetail(
  productId: string,
): Promise<CatalogProductDetail | null> {
  const sdk = getMedusaAdminSdk();
  if (!sdk) return null;
  try {
    const currencyCodeResolved = await getCatalogPriceCurrencyCode();
    const { product } = await sdk.admin.product.retrieve(productId, {
      fields:
        "id,title,handle,description,status,thumbnail,metadata,*images,*variants,*variants.prices,*variants.metadata,*variants.options,*variants.options.option,*categories,*options",
    });
    if (!product) return null;
    const variants = product.variants ?? [];
    const variantCount = variants.length;
    const variantSummaries =
      variantCount > 1
        ? variants.map((v) => ({
            id: String(v.id ?? ""),
            sku: typeof v.sku === "string" ? v.sku : null,
            title: typeof (v as { title?: string }).title === "string"
              ? (v as { title?: string }).title
              : undefined,
          }))
        : undefined;
    const first = variants[0];
    const variantId =
      variantCount === 1 && first?.id ? String(first.id) : null;
    let sku: string | null = null;
    let pricePhp: number | null = null;
    const optRows = (first?.options ?? []) as Parameters<
      typeof optionRowsToSizeColor
    >[0];
    const { size: sizeLabel, color: colorLabel } =
      optionRowsToSizeColor(optRows);

    const sizesFromVariants: string[] = [];
    const colorsFromVariants: string[] = [];
    for (const v of variants) {
      const rows = (v?.options ?? []) as Parameters<
        typeof optionRowsToSizeColor
      >[0];
      const { size: sv, color: cv } = optionRowsToSizeColor(rows);
      if (sv.trim()) sizesFromVariants.push(sv.trim());
      if (cv.trim()) colorsFromVariants.push(cv.trim());
    }
    let matrixSizes = uniqueOptionValuesPreservingOrder(sizesFromVariants);
    let matrixColors = uniqueOptionValuesPreservingOrder(colorsFromVariants);
    if (matrixSizes.length === 0) {
      matrixSizes = [(sizeLabel || "One Size").trim() || "One Size"];
    }
    if (matrixColors.length === 0) {
      matrixColors = [(colorLabel || "Default").trim() || "Default"];
    }

    const productOptions = (product as { options?: Array<{ title?: string }> })
      .options;
    const optionTitles = (productOptions ?? []).map((o) =>
      String(o.title ?? "").toLowerCase(),
    );
    const shopVariantOptionsReady =
      optionTitles.some((t) => t.includes("size")) &&
      optionTitles.some((t) => t.includes("color"));

    const rawCats = (product as {
      categories?: Array<{ id?: string; name?: string; handle?: string }>;
    }).categories;
    const categoryIds = (rawCats ?? [])
      .map((c) => (c?.id != null ? String(c.id) : ""))
      .filter(Boolean);
    const categoryHandles = (rawCats ?? [])
      .map((c) => (typeof c?.handle === "string" ? c.handle.trim() : ""))
      .filter(Boolean);
    const categoryLabels = (rawCats ?? [])
      .map((c) => (c?.name != null ? String(c.name) : ""))
      .filter(Boolean);

    let variantBarcode: string | null = null;
    let stockQuantity: number | null = null;
    const variantStockRows: CatalogVariantStockRow[] = [];
    if (first) {
      sku = typeof first.sku === "string" && first.sku ? first.sku : null;
      const bc = (first as { barcode?: string | null }).barcode;
      variantBarcode =
        typeof bc === "string" && bc.trim() ? bc.trim() : null;
      const prices = first.prices ?? [];
      const priceRow =
        prices.find(
          (pr) =>
            (pr.currency_code ?? "").toLowerCase() === currencyCodeResolved,
        ) ??
        prices.find((pr) => (pr.currency_code ?? "").toLowerCase() === "php") ??
        prices[0];
      if (priceRow && typeof priceRow.amount === "number") {
        pricePhp = phpMinorUnitsToPesos(priceRow.amount);
      }
    }

    const loadedRows = await Promise.all(
      variants
        .filter((v) => v?.id != null && String(v.id).length > 0)
        .map(async (v) => {
          const vid = String(v.id);
          const optRows = (v?.options ?? []) as Parameters<
            typeof optionRowsToSizeColor
          >[0];
          const { size: szRaw, color: colRaw } = optionRowsToSizeColor(optRows);
          const sizeLabel = szRaw.trim() || "One Size";
          const colorLabel = colRaw.trim() || "Default";
          const stockedQuantity = await fetchVariantStockedQuantity(vid);
          return {
            variantId: vid,
            sizeLabel,
            colorLabel,
            label: `${sizeLabel} / ${colorLabel}`,
            stockedQuantity,
          };
        }),
    );
    variantStockRows.push(...loadedRows);

    if (variantCount === 1 && variantId && variantStockRows.length === 1) {
      stockQuantity = variantStockRows[0]?.stockedQuantity ?? null;
    }
    const rawMeta = (product as { metadata?: Record<string, unknown> | null })
      .metadata;
    const storefrontMetadata = catalogMetadataFromMedusa(rawMeta);
    const storefrontMetadataSignature =
      buildStorefrontMetadataSignature(storefrontMetadata);

    const rawImages = (
      product as { images?: Array<{ url?: string | null } | null> | null }
    ).images;
    let imageUrls = (rawImages ?? [])
      .filter(Boolean)
      .map((im) => (typeof im?.url === "string" ? im.url.trim() : ""))
      .filter(Boolean);
    const thumb =
      typeof product.thumbnail === "string" ? product.thumbnail.trim() : "";
    if (imageUrls.length === 0 && thumb) {
      imageUrls = [thumb];
    }

    const variantSellPriceSignature = buildVariantSellPriceSignature(
      variants as Array<{
        id?: string;
        prices?: Array<{ amount?: number; currency_code?: string | null }>;
      }>,
      currencyCodeResolved,
    );
    const variantCompareAtSignature = buildVariantCompareAtSignature(
      variants as Array<{
        id?: string;
        metadata?: Record<string, unknown> | null;
      }>,
    );
    const editorialSurfaceSignature = buildEditorialSurfaceSignature({
      title: String(product.title ?? ""),
      description:
        typeof product.description === "string" ? product.description : null,
      thumbnail:
        typeof product.thumbnail === "string" ? product.thumbnail : null,
      imageUrls,
    });
    const revision = createHash("sha256")
      .update(
        JSON.stringify({
          id: product.id,
          title: product.title,
          handle: product.handle,
          description: product.description,
          status: product.status,
          thumbnail: product.thumbnail,
          imageUrls,
          categoryIds,
          variantSellPriceSignature,
          variantCompareAtSignature,
          storefrontMetadataSignature,
          variantStockRows: loadedRows.map((row) => [row.variantId, row.stockedQuantity]),
        }),
      )
      .digest("hex");

    return {
      id: String(product.id),
      title: String(product.title ?? ""),
      handle: String(product.handle ?? ""),
      description:
        typeof product.description === "string" ? product.description : null,
      status: String(product.status ?? "draft"),
      thumbnail:
        typeof product.thumbnail === "string" ? product.thumbnail : null,
      imageUrls,
      variantCount,
      variantId,
      sku,
      pricePhp,
      currencyCode: currencyCodeResolved,
      categoryIds,
      categoryHandles,
      categoryLabels,
      sizeLabel,
      colorLabel,
      matrixSizes,
      matrixColors,
      shopVariantOptionsReady,
      stockQuantity,
      variantStockRows,
      variantBarcode,
      storefrontMetadata,
      revision,
      variantSummaries,
      variantSellPriceSignature,
      variantCompareAtSignature,
      editorialSurfaceSignature,
      storefrontMetadataSignature,
    };
  } catch {
    return null;
  }
}

export async function fetchFirstShippingProfileId(): Promise<string | null> {
  const sdk = getMedusaAdminSdk();
  if (!sdk) return null;
  try {
    const { shipping_profiles } = await sdk.admin.shippingProfile.list({
      limit: 1,
    });
    const id = shipping_profiles?.[0]?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Resolve shipping profile id, or null if Medusa unreachable / empty. */
export async function resolveShippingProfileIdForCatalog(): Promise<
  string | null
> {
  const sdk = getMedusaAdminSdk();
  if (!sdk) {
    const res = await medusaAdminFetch(
      "/admin/shipping-profiles?limit=1",
    ).catch(() => null);
    if (!res?.ok) return null;
    const j = (await res.json()) as {
      shipping_profiles?: Array<{ id?: string }>;
    };
    const id = j.shipping_profiles?.[0]?.id;
    return typeof id === "string" ? id : null;
  }
  return fetchFirstShippingProfileId();
}
