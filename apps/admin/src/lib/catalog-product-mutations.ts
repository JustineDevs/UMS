import type { AdminOperationResult } from "@/lib/admin-operation-result";
import { adminErr, adminOk } from "@/lib/admin-operation-result";
import {
  getCatalogPriceCurrencyCode,
  phpPesosToMinorUnits,
  resolveShippingProfileIdForCatalog,
} from "@/lib/medusa-catalog-service";
import { applyVariantStockedQuantity } from "@/lib/medusa-catalog-inventory-stock";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import {
  getMedusaAdminSdk,
  getMedusaSalesChannelId,
  optionRowsToSizeColor,
} from "@/lib/medusa-pos";
import {
  EMPTY_CATALOG_METADATA_FIELDS,
  mergeStorefrontProductMetadata,
  validateHotspotsJsonField,
  type CatalogProductMetadataFields,
} from "@/lib/catalog-product-metadata";
import {
  commerceFailureHttpStatus,
  formatMedusaSdkError,
} from "@/lib/medusa-sdk-error";
import { mergeSalesChannelsForProductUpdate } from "@/lib/sales-channel-utils";
import {
  normalizeStockQuantity,
  validateVariantStocksInput,
} from "@/lib/catalog-stock-validation";

/**
 * Bodies map to Medusa Admin `product.create` / `product.update` + `updateVariant`.
 * Draft products are not visible on the Store API until status is `published` and the product is in the cart sales channel.
 */
export type CreateCatalogProductBody = {
  title: string;
  handle?: string;
  description?: string | null;
  status: "draft" | "published";
  pricePhp: number;
  sku?: string | null;
  /** Medusa gallery; first URL is also used as thumbnail when present. */
  imageUrls?: string[] | null;
  /** @deprecated Prefer imageUrls; still supported as single image. */
  thumbnail?: string | null;
  /** Medusa product category ids (shop filters by category). */
  categoryIds?: string[] | null;
  /** Size option value for the single variant (storefront size filter). Default One Size. */
  sizeLabel?: string | null;
  /** Color option value for the single variant (storefront color filter). Default Default. */
  colorLabel?: string | null;
  /**
   * Create one variant per size × color when both arrays are non-empty.
   * Omitted or empty falls back to {@link sizeLabel} / {@link colorLabel}.
   */
  sizeLabels?: string[] | null;
  colorLabels?: string[] | null;
  /** Initial stocked quantity at the default warehouse (optional). */
  stockQuantity?: number;
  /** Medusa variant barcode (single-variant products). */
  variantBarcode?: string | null;
  /** Storefront metadata (brand, SEO, media, related handles). */
  storefrontMetadata?: CatalogProductMetadataFields;
};

export type UpdateCatalogProductBody = {
  title: string;
  handle: string;
  description?: string | null;
  status: "draft" | "published";
  pricePhp: number;
  sku?: string | null;
  imageUrls?: string[] | null;
  thumbnail?: string | null;
  categoryIds?: string[] | null;
  /**
   * Size × color matrix (same as create). Both must be sent; each list must have at least one value.
   */
  sizeLabels: string[];
  colorLabels: string[];
  /** Default stocked quantity for variants without a row in {@link variantStocks}. */
  stockQuantity?: number;
  /**
   * Per-variant stocked quantity at the default warehouse. Ids not in the synced matrix are ignored.
   */
  variantStocks?: Array<{ variantId: string; quantity: number }>;
  /**
   * Stock by matrix cell (size × color). Applied after variants sync; overrides {@link variantStocks} for the same variant.
   */
  matrixCellStocks?: Array<{
    sizeLabel: string;
    colorLabel: string;
    quantity: number;
  }>;
  variantBarcode?: string | null;
  storefrontMetadata?: CatalogProductMetadataFields;
};

export function validateStorefrontMetadataInput(
  fields: CatalogProductMetadataFields | undefined,
): string | null {
  if (!fields) return null;
  return validateHotspotsJsonField(fields.hotspotsJson);
}

function slugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

const MAX_CATALOG_HANDLE_LEN = 200;

/** Lowercase URL-safe handle for Medusa (a-z, 0-9, hyphens). */
function normalizeCatalogProductHandle(raw: string, fallback: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_CATALOG_HANDLE_LEN);
  return s || fallback;
}

function normalizeCategoryIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return ids.filter((x) => typeof x === "string" && x.trim().length > 0);
}

const MAX_IMAGE_URL_LEN = 8000;

function isAllowedImageSource(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > MAX_IMAGE_URL_LEN) return false;
  const head = t.slice(0, 24).toLowerCase().replace(/^\s+/, "");
  if (head.startsWith("javascript:") || head.startsWith("vbscript:")) {
    return false;
  }
  return true;
}

function normalizeProductImageUrls(body: {
  imageUrls?: string[] | null;
  thumbnail?: string | null;
}): string[] {
  if (Array.isArray(body.imageUrls) && body.imageUrls.length > 0) {
    return body.imageUrls
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim())
      .filter(isAllowedImageSource);
  }
  const t = typeof body.thumbnail === "string" ? body.thumbnail.trim() : "";
  return t && isAllowedImageSource(t) ? [t.trim()] : [];
}

function categoryLinks(ids: string[]): Array<{ id: string }> {
  return ids.map((id) => ({ id }));
}

const MAX_VARIANT_MATRIX = 80;
const MAX_OPTION_VALUES = 40;

/** Dedupe and trim option values for variant matrix (no fallback when empty). */
function dedupeOptionValues(
  input: string[] | null | undefined,
  max = MAX_OPTION_VALUES,
): string[] {
  const cleaned = (input ?? [])
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, 100))
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const v of cleaned) {
    if (seen.has(v)) continue;
    seen.add(v);
    unique.push(v);
    if (unique.length >= max) break;
  }
  return unique;
}

function normalizeOptionLabelList(
  fromArray: string[] | null | undefined,
  single: string | null | undefined,
  fallback: string,
): string[] {
  const cleaned = (fromArray ?? [])
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, 100))
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const v of cleaned) {
    if (seen.has(v)) continue;
    seen.add(v);
    unique.push(v);
    if (unique.length >= MAX_OPTION_VALUES) break;
  }
  if (unique.length > 0) return unique;
  const one = (single?.trim() || fallback).slice(0, 100);
  return one ? [one] : [fallback];
}

export { mergeSalesChannelsForProductUpdate } from "@/lib/sales-channel-utils";

function productHasSizeAndColorOptions(
  options: Array<{ title?: string | null }> | null | undefined,
): boolean {
  const titles = (options ?? []).map((o) =>
    String(o.title ?? "").toLowerCase(),
  );
  return (
    titles.some((t) => t.includes("size")) &&
    titles.some((t) => t.includes("color"))
  );
}

function variantPairKey(size: string, color: string): string {
  return `${size}\u0000${color}`;
}

type CatalogVariantLike = {
  id?: string | null;
  options?: Array<{
    option?: { title?: string | null } | null;
    value?: string | null;
  } | null> | null;
};

function pairFromCatalogVariant(v: CatalogVariantLike): {
  size: string;
  color: string;
} {
  const { size, color } = optionRowsToSizeColor(
    (v.options ?? []).filter((o): o is NonNullable<typeof o> => o != null),
  );
  return {
    size: size.trim() || "One Size",
    color: color.trim() || "Default",
  };
}

async function adminDeleteProductVariant(
  productId: string,
  variantId: string,
): Promise<void> {
  const res = await medusaAdminFetch(
    `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `Delete variant failed (${res.status}): ${t.slice(0, 400)}`,
    );
  }
}

async function adminCreateProductVariant(
  productId: string,
  body: {
    title: string;
    sku?: string | null;
    barcode?: string | null;
    manage_inventory: boolean;
    options: Record<string, string>;
    prices: Array<{ amount: number; currency_code: string }>;
  },
): Promise<string> {
  const wrapped = { variant: body };
  let res = await medusaAdminFetch(
    `/admin/products/${encodeURIComponent(productId)}/variants`,
    {
      method: "POST",
      body: JSON.stringify(wrapped),
    },
  );
  let text = await res.text();
  if (!res.ok) {
    res = await medusaAdminFetch(
      `/admin/products/${encodeURIComponent(productId)}/variants`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    text = await res.text();
  }
  if (!res.ok) {
    throw new Error(
      `Create variant failed (${res.status}): ${text.slice(0, 800)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Create variant: response was not JSON");
  }
  const j = parsed as {
    variant?: { id?: string };
    product?: { variants?: Array<{ id?: string }> };
  };
  const id =
    j.variant?.id ??
    (j.product?.variants?.length
      ? j.product!.variants![j.product!.variants!.length - 1]?.id
      : undefined);
  if (!id) throw new Error("Create variant: missing variant id in response");
  return String(id);
}

export async function createCatalogProduct(
  body: CreateCatalogProductBody,
): Promise<AdminOperationResult<{ productId: string }>> {
  const sdk = getMedusaAdminSdk();
  if (!sdk) {
    return adminErr(
      "COMMERCE_UNAVAILABLE",
      "Store connection is not configured. Ask your administrator to set the commerce API key.",
      503,
    );
  }
  const title = body.title.trim();
  if (!title) {
    return adminErr("VALIDATION", "Title is required.", 400);
  }
  if (!Number.isFinite(body.pricePhp) || body.pricePhp < 0) {
    return adminErr("VALIDATION", "Enter a valid price.", 400);
  }
  const shippingProfileId = await resolveShippingProfileIdForCatalog();
  if (!shippingProfileId) {
    return adminErr(
      "COMMERCE_UNAVAILABLE",
      "No shipping profile found in your store. Create one in your store admin or run setup.",
      503,
    );
  }
  const titleSlug = slugFromTitle(title);
  const handle = normalizeCatalogProductHandle(
    body.handle?.trim() ?? "",
    titleSlug || "product",
  );
  const salesChannelId = getMedusaSalesChannelId();
  const amount = phpPesosToMinorUnits(body.pricePhp);
  const categoryIds = normalizeCategoryIds(body.categoryIds ?? undefined);

  const matrixMode =
    body.sizeLabels !== undefined && body.colorLabels !== undefined;
  let sizeLabels: string[];
  let colorLabels: string[];
  if (matrixMode) {
    sizeLabels = dedupeOptionValues(body.sizeLabels);
    colorLabels = dedupeOptionValues(body.colorLabels);
    if (sizeLabels.length < 1 || colorLabels.length < 1) {
      return adminErr(
        "VALIDATION",
        "Select at least one size and one color for your variants.",
        400,
      );
    }
  } else {
    sizeLabels = normalizeOptionLabelList(
      undefined,
      body.sizeLabel ?? undefined,
      "One Size",
    );
    colorLabels = normalizeOptionLabelList(
      undefined,
      body.colorLabel ?? undefined,
      "Default",
    );
  }

  const variantCount = sizeLabels.length * colorLabels.length;
  if (variantCount > MAX_VARIANT_MATRIX) {
    return adminErr(
      "VALIDATION",
      `Too many variants (${variantCount}). Maximum is ${MAX_VARIANT_MATRIX}. Reduce sizes or colors.`,
      400,
    );
  }

  const metaErr = validateStorefrontMetadataInput(body.storefrontMetadata);
  if (metaErr) {
    return adminErr("VALIDATION", metaErr, 400);
  }
  if (
    body.stockQuantity !== undefined &&
    body.stockQuantity !== null &&
    normalizeStockQuantity(body.stockQuantity) === undefined
  ) {
    return adminErr(
      "VALIDATION",
      "Enter a valid initial stock quantity (whole number, zero or more).",
      400,
    );
  }
  const storefrontMeta =
    body.storefrontMetadata ?? EMPTY_CATALOG_METADATA_FIELDS;
  const mergedMeta = mergeStorefrontProductMetadata(null, storefrontMeta);
  const barcodeTrim =
    typeof body.variantBarcode === "string" ? body.variantBarcode.trim() : "";

  try {
    const priceCurrency = await getCatalogPriceCurrencyCode();
    const variantsPayload = [];
    for (const sz of sizeLabels) {
      for (const col of colorLabels) {
        variantsPayload.push({
          manage_inventory: true,
          title: `${sz} / ${col}`,
          sku: variantCount === 1 ? body.sku?.trim() || undefined : undefined,
          barcode: variantCount === 1 ? barcodeTrim || undefined : undefined,
          options: { Size: sz, Color: col },
          prices: [{ amount, currency_code: priceCurrency }],
        });
      }
    }

    const { product } = await sdk.admin.product.create({
      title,
      handle,
      description: body.description?.trim() || undefined,
      status: body.status === "published" ? "published" : "draft",
      shipping_profile_id: shippingProfileId,
      categories: categoryIds.length ? categoryLinks(categoryIds) : undefined,
      options: [
        { title: "Size", values: sizeLabels },
        { title: "Color", values: colorLabels },
      ],
      variants: variantsPayload,
      images: (() => {
        const urls = normalizeProductImageUrls(body);
        return urls.length ? urls.map((url) => ({ url })) : undefined;
      })(),
      thumbnail: (() => {
        const urls = normalizeProductImageUrls(body);
        return urls[0] ?? undefined;
      })(),
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata:
        Object.keys(mergedMeta).length > 0
          ? (mergedMeta as Record<string, unknown>)
          : undefined,
    });
    const id = product?.id;
    if (!id) {
      return adminErr(
        "COMMERCE_ERROR",
        "Create succeeded but product id missing.",
        502,
      );
    }
    const productId = String(id);
    const stockQty = normalizeStockQuantity(body.stockQuantity);
    if (stockQty !== undefined) {
      const { product: withVariants } = await sdk.admin.product.retrieve(
        productId,
        {
          fields: "id,*variants",
        },
      );
      const vids = (withVariants?.variants ?? [])
        .map((v) => v?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      for (const vid of vids) {
        const applied = await applyVariantStockedQuantity({
          productId,
          variantId: vid,
          stockedQuantity: stockQty,
        });
        if (!applied.ok) {
          return adminErr("COMMERCE_ERROR", `Stock: ${applied.message}`, 502);
        }
      }
    }
    return adminOk({ productId });
  } catch (e) {
    return adminErr(
      "COMMERCE_ERROR",
      formatMedusaSdkError(e),
      commerceFailureHttpStatus(e),
    );
  }
}

export async function updateCatalogProduct(
  productId: string,
  body: UpdateCatalogProductBody,
): Promise<AdminOperationResult<{ productId: string }>> {
  const sdk = getMedusaAdminSdk();
  if (!sdk) {
    return adminErr(
      "COMMERCE_UNAVAILABLE",
      "Store connection is not configured. Ask your administrator to set the commerce API key.",
      503,
    );
  }
  const title = body.title.trim();
  if (!title) {
    return adminErr("VALIDATION", "Title is required.", 400);
  }
  if (!Number.isFinite(body.pricePhp) || body.pricePhp < 0) {
    return adminErr("VALIDATION", "Enter a valid price.", 400);
  }
  const metaErr = validateStorefrontMetadataInput(body.storefrontMetadata);
  if (metaErr) {
    return adminErr("VALIDATION", metaErr, 400);
  }

  const sizeLabels = dedupeOptionValues(body.sizeLabels);
  const colorLabels = dedupeOptionValues(body.colorLabels);
  if (sizeLabels.length < 1 || colorLabels.length < 1) {
    return adminErr(
      "VALIDATION",
      "Select at least one size and one color for your variants.",
      400,
    );
  }
  const variantCountTarget = sizeLabels.length * colorLabels.length;
  if (variantCountTarget > MAX_VARIANT_MATRIX) {
    return adminErr(
      "VALIDATION",
      `Too many variants (${variantCountTarget}). Maximum is ${MAX_VARIANT_MATRIX}. Reduce sizes or colors.`,
      400,
    );
  }

  const desiredPairs: Array<{ sz: string; col: string }> = [];
  for (const sz of sizeLabels) {
    for (const col of colorLabels) {
      desiredPairs.push({ sz, col });
    }
  }
  const desiredKeys = new Set(
    desiredPairs.map((p) => variantPairKey(p.sz, p.col)),
  );

  try {
    const priceCurrency = await getCatalogPriceCurrencyCode();
    const amount = phpPesosToMinorUnits(body.pricePhp);

    const { product: current } = await sdk.admin.product.retrieve(productId, {
      fields:
        "id,metadata,*sales_channels,*variants,*variants.options,*variants.options.option,*variants.prices,*options,*categories",
    });
    if (!current?.id) {
      return adminErr("NOT_FOUND", "Product not found.", 404);
    }

    const currentOptions = (
      current as { options?: Array<{ title?: string | null }> }
    ).options;
    const hasSizeAndColor = productHasSizeAndColorOptions(currentOptions);
    const variantsRaw = (current.variants ?? []) as CatalogVariantLike[];

    if (!hasSizeAndColor && variantsRaw.length > 1) {
      return adminErr(
        "VALIDATION",
        "This product has multiple variants without Size and Color options. Fix it in your store admin or recreate the product here.",
        400,
      );
    }

    let legacyOnlyVariantId: string | null = null;
    if (!hasSizeAndColor && variantsRaw.length === 1) {
      const vid = variantsRaw[0]?.id;
      legacyOnlyVariantId = vid ? String(vid) : null;
    }

    const toDeleteIds: string[] = [];
    for (const v of variantsRaw) {
      const vid = v.id ? String(v.id) : "";
      if (!vid) continue;
      if (legacyOnlyVariantId && vid === legacyOnlyVariantId) continue;
      const { size, color } = pairFromCatalogVariant(v);
      const k = variantPairKey(size, color);
      if (!desiredKeys.has(k)) toDeleteIds.push(vid);
    }

    const variantIdsPresent = variantsRaw
      .map((v) => (v.id ? String(v.id) : ""))
      .filter(Boolean);
    let reassignVariantId: string | null = null;
    if (
      variantIdsPresent.length > 0 &&
      toDeleteIds.length === variantIdsPresent.length
    ) {
      reassignVariantId = variantIdsPresent[0] ?? null;
      const filtered = toDeleteIds.filter((id) => id !== reassignVariantId);
      toDeleteIds.length = 0;
      toDeleteIds.push(...filtered);
    }

    for (const vid of toDeleteIds) {
      try {
        await adminDeleteProductVariant(productId, vid);
      } catch (e) {
        return adminErr(
          "COMMERCE_ERROR",
          e instanceof Error ? e.message : String(e),
          502,
        );
      }
    }

    const categoryIds = normalizeCategoryIds(body.categoryIds ?? undefined);
    const existingMeta =
      (current as { metadata?: Record<string, unknown> | null }).metadata ??
      null;
    const imgUrls = normalizeProductImageUrls(body);
    const titleSlug = slugFromTitle(title);
    const normalizedHandle = normalizeCatalogProductHandle(
      body.handle.trim(),
      titleSlug || "product",
    );

    const productUpdatePayload: Parameters<typeof sdk.admin.product.update>[1] =
      {
        title,
        handle: normalizedHandle,
        description: body.description?.trim() || null,
        status: body.status === "published" ? "published" : "draft",
        thumbnail: imgUrls[0] ?? null,
        images: imgUrls.map((url) => ({ url })),
        categories: categoryLinks(categoryIds),
      };

    const mergedChannels = mergeSalesChannelsForProductUpdate(
      (current as { sales_channels?: Array<{ id?: string | null }> })
        .sales_channels,
      getMedusaSalesChannelId(),
    );
    if (mergedChannels?.length) {
      productUpdatePayload.sales_channels = mergedChannels;
    }

    if (body.storefrontMetadata !== undefined) {
      productUpdatePayload.metadata = mergeStorefrontProductMetadata(
        existingMeta,
        body.storefrontMetadata,
      ) as Record<string, unknown>;
    }

    try {
      await sdk.admin.product.update(productId, productUpdatePayload);
    } catch (e) {
      return adminErr(
        "COMMERCE_ERROR",
        `Product update: ${formatMedusaSdkError(e)}`,
        commerceFailureHttpStatus(e),
      );
    }

    const singleVariantMode = variantCountTarget === 1;
    const barcodePatch =
      body.variantBarcode !== undefined
        ? typeof body.variantBarcode === "string"
          ? body.variantBarcode.trim() || null
          : null
        : undefined;
    const skuVal = singleVariantMode ? body.sku?.trim() || null : null;

    const firstPair = desiredPairs[0];
    const pivotVariantId = legacyOnlyVariantId ?? reassignVariantId;
    if (pivotVariantId && firstPair) {
      try {
        await sdk.admin.product.updateVariant(productId, pivotVariantId, {
          manage_inventory: true,
          title: `${firstPair.sz} / ${firstPair.col}`,
          options: { Size: firstPair.sz, Color: firstPair.col },
          prices: [{ amount, currency_code: priceCurrency }],
          ...(singleVariantMode ? { sku: skuVal } : {}),
          ...(barcodePatch !== undefined ? { barcode: barcodePatch } : {}),
        });
      } catch (e) {
        return adminErr(
          "COMMERCE_ERROR",
          `Variant update: ${formatMedusaSdkError(e)}`,
          commerceFailureHttpStatus(e),
        );
      }
    }

    const { product: afterOptions } = await sdk.admin.product.retrieve(
      productId,
      {
        fields:
          "id,*variants,*variants.options,*variants.options.option,*variants.prices",
      },
    );
    const freshList = (afterOptions?.variants ?? []) as CatalogVariantLike[];

    function variantMapFromList(
      list: CatalogVariantLike[],
    ): Map<string, string> {
      const m = new Map<string, string>();
      for (const v of list) {
        const vid = v.id ? String(v.id) : "";
        if (!vid) continue;
        const { size, color } = pairFromCatalogVariant(v);
        m.set(variantPairKey(size, color), vid);
      }
      return m;
    }

    let keyToVariantId = variantMapFromList(freshList);

    for (const { sz, col } of desiredPairs) {
      const k = variantPairKey(sz, col);
      if (keyToVariantId.has(k)) continue;
      try {
        const newId = await adminCreateProductVariant(productId, {
          title: `${sz} / ${col}`,
          manage_inventory: true,
          options: { Size: sz, Color: col },
          prices: [{ amount, currency_code: priceCurrency }],
        });
        keyToVariantId.set(k, newId);
      } catch (e) {
        return adminErr(
          "COMMERCE_ERROR",
          e instanceof Error ? e.message : String(e),
          502,
        );
      }
    }

    const { product: finalProduct } = await sdk.admin.product.retrieve(
      productId,
      {
        fields:
          "id,*variants,*variants.options,*variants.options.option,*variants.prices",
      },
    );
    keyToVariantId = variantMapFromList(
      (finalProduct?.variants ?? []) as CatalogVariantLike[],
    );

    for (const { sz, col } of desiredPairs) {
      const k = variantPairKey(sz, col);
      const vid = keyToVariantId.get(k);
      if (!vid) {
        return adminErr(
          "COMMERCE_ERROR",
          `Missing variant after sync for ${sz} / ${col}.`,
          502,
        );
      }
      const variantPayload: Parameters<
        typeof sdk.admin.product.updateVariant
      >[2] = {
        manage_inventory: true,
        title: `${sz} / ${col}`,
        prices: [{ amount, currency_code: priceCurrency }],
      };
      if (singleVariantMode) {
        variantPayload.sku = skuVal;
        if (barcodePatch !== undefined) {
          variantPayload.barcode = barcodePatch;
        }
      }
      try {
        await sdk.admin.product.updateVariant(productId, vid, variantPayload);
      } catch (e) {
        return adminErr(
          "COMMERCE_ERROR",
          `Variant update: ${formatMedusaSdkError(e)}`,
          commerceFailureHttpStatus(e),
        );
      }
    }

    const allowedVariantIds = new Set(keyToVariantId.values());
    if (body.variantStocks?.length) {
      const vsErr = validateVariantStocksInput(
        body.variantStocks,
        allowedVariantIds,
      );
      if (vsErr) {
        return adminErr("VALIDATION", vsErr, 400);
      }
    }
    if (
      body.stockQuantity !== undefined &&
      body.stockQuantity !== null &&
      normalizeStockQuantity(body.stockQuantity) === undefined
    ) {
      return adminErr(
        "VALIDATION",
        "Enter a valid default stock quantity (whole number, zero or more).",
        400,
      );
    }

    const defaultStock = normalizeStockQuantity(body.stockQuantity);
    const overrideMap = new Map<string, number>();
    for (const row of body.variantStocks ?? []) {
      const id = typeof row.variantId === "string" ? row.variantId.trim() : "";
      if (!id) continue;
      const q = normalizeStockQuantity(row.quantity);
      if (q === undefined) continue;
      overrideMap.set(id, q);
    }
    for (const cell of body.matrixCellStocks ?? []) {
      const sz =
        typeof cell.sizeLabel === "string" ? cell.sizeLabel.trim() : "";
      const col =
        typeof cell.colorLabel === "string" ? cell.colorLabel.trim() : "";
      if (!sz || !col) continue;
      const k = variantPairKey(sz, col);
      const vid = keyToVariantId.get(k);
      if (!vid) continue;
      const q = normalizeStockQuantity(cell.quantity);
      if (q === undefined) continue;
      overrideMap.set(vid, q);
    }
    const hasStockPatch = defaultStock !== undefined || overrideMap.size > 0;
    if (hasStockPatch) {
      for (const vid of keyToVariantId.values()) {
        const qty = overrideMap.has(vid) ? overrideMap.get(vid)! : defaultStock;
        if (qty === undefined) continue;
        const applied = await applyVariantStockedQuantity({
          productId,
          variantId: vid,
          stockedQuantity: qty,
        });
        if (!applied.ok) {
          return adminErr("COMMERCE_ERROR", `Stock: ${applied.message}`, 502);
        }
      }
    }

    return adminOk({ productId });
  } catch (e) {
    const msg = formatMedusaSdkError(e);
    if (msg.toLowerCase().includes("not found")) {
      return adminErr("NOT_FOUND", "Product not found.", 404);
    }
    return adminErr(
      "COMMERCE_ERROR",
      `Load product: ${msg}`,
      commerceFailureHttpStatus(e),
    );
  }
}

export async function deleteCatalogProduct(
  productId: string,
): Promise<AdminOperationResult<{ deleted: boolean }>> {
  const sdk = getMedusaAdminSdk();
  if (!sdk) {
    return adminErr(
      "COMMERCE_UNAVAILABLE",
      "Store connection is not configured. Ask your administrator to set the commerce API key.",
      503,
    );
  }
  try {
    await sdk.admin.product.delete(productId);
    return adminOk({ deleted: true });
  } catch (e) {
    return adminErr(
      "COMMERCE_ERROR",
      formatMedusaSdkError(e),
      commerceFailureHttpStatus(e),
    );
  }
}
