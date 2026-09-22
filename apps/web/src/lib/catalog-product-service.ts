import {
  fetchWorkerCatalogProductDetailForAdmin,
  type WorkerAdminCatalogProductDetail,
} from "@/lib/worker-admin-bridge";
import {
  catalogMetadataFromMedusa,
  type CatalogProductMetadataFields,
} from "@/lib/catalog-product-metadata";

export type CatalogVariantStockRow = {
  variantId: string;
  sizeLabel: string;
  colorLabel: string;
  label: string;
  stockedQuantity: number | null;
};

export type CatalogProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  status: string;
  thumbnail: string | null;
  imageUrls: string[];
  variantCount: number;
  variantId: string | null;
  sku: string | null;
  pricePhp: number | null;
  currencyCode: string;
  categoryIds: string[];
  categoryHandles: string[];
  categoryLabels: string[];
  sizeLabel: string;
  colorLabel: string;
  matrixSizes: string[];
  matrixColors: string[];
  shopVariantOptionsReady: boolean;
  stockQuantity: number | null;
  variantStockRows: CatalogVariantStockRow[];
  variantBarcode: string | null;
  storefrontMetadata: CatalogProductMetadataFields;
  variantSummaries?: Array<{ id: string; sku: string | null; title?: string }>;
  variantSellPriceSignature: string;
  variantCompareAtSignature: string;
  editorialSurfaceSignature: string;
  storefrontMetadataSignature: string;
  /** Worker product.updated_at; the Worker checks it under a row lock. */
  revision?: string;
};

function unique(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }))];
}

function optionValues(options: Array<{ title?: string; value?: string }> = []) {
  const find = (name: string, fallback: string) =>
    options.find((option) => option.title?.trim().toLowerCase() === name)?.value?.trim() || fallback;
  return { size: find("size", "One Size"), color: find("color", "Default") };
}

function minorAmount(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function mapWorkerCatalogProductDetail(product: WorkerAdminCatalogProductDetail | null): CatalogProductDetail | null {
  if (!product) return null;
  const variants = product.variants ?? [];
  const first = variants[0];
  const labels = optionValues(first?.options);
  const variantStockRows = variants.map((variant) => {
    const variantLabels = optionValues(variant.options);
    const rawStock = variant.inventory_quantity == null ? null : Number(variant.inventory_quantity);
    const stockedQuantity = rawStock !== null && Number.isSafeInteger(rawStock) ? rawStock : null;
    return {
      variantId: variant.id,
      sizeLabel: variantLabels.size,
      colorLabel: variantLabels.color,
      label: `${variantLabels.size} / ${variantLabels.color}`,
      stockedQuantity,
    };
  });
  const currencyCode = first?.prices?.find((price) => price.currency_code)?.currency_code?.toLowerCase() ?? "php";
  const sellSignature = variants.map((variant) => {
    const price = variant.prices?.find((item) => item.currency_code?.toLowerCase() === currencyCode) ?? variant.prices?.[0];
    return `${variant.id}:${minorAmount(price?.amount) ?? -1}`;
  }).sort().join("|");
  const compareSignature = variants.map((variant) => `${variant.id}:${variant.metadata?.legacy_compare_at_price_minor ?? "none"}`).sort().join("|");
  const imageUrls = product.images.slice().sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0)).flatMap((image) => {
    const url = image.url?.trim() ?? "";
    return url ? [url] : [];
  });
  const thumbnail = product.thumbnail?.trim() || null;
  const resolvedImages = imageUrls.length ? imageUrls : thumbnail ? [thumbnail] : [];
  const metadata = catalogMetadataFromMedusa(product.metadata);
  const title = product.title;
  const description = product.description;
  const editorialSurfaceSignature = [title.trim(), (description ?? "").trim(), (thumbnail ?? "").trim(), resolvedImages.join(",")].join("\u0001");
  const storefrontMetadataSignature = JSON.stringify({
    brand: metadata.brand,
    videoUrl: metadata.videoUrl,
    galleryVideoUrlsText: metadata.galleryVideoUrlsText,
    weightKg: metadata.weightKg,
    dimensionsLabel: metadata.dimensionsLabel,
    material: metadata.material,
    lifestyleImageUrl: metadata.lifestyleImageUrl,
    seoDescription: metadata.seoDescription,
    relatedHandlesText: metadata.relatedHandlesText,
    hotspotsJson: metadata.hotspotsJson,
  });
  const sizes = unique(variantStockRows.map((row) => row.sizeLabel));
  const colors = unique(variantStockRows.map((row) => row.colorLabel));
  const amount = minorAmount(first?.prices?.find((price) => price.currency_code?.toLowerCase() === currencyCode)?.amount ?? first?.prices?.[0]?.amount);
  return {
    id: product.id,
    title,
    handle: product.handle,
    description,
    status: product.status,
    thumbnail,
    imageUrls: resolvedImages,
    variantCount: variants.length,
    variantId: variants.length === 1 ? first?.id ?? null : null,
    sku: first?.sku?.trim() || null,
    pricePhp: amount === null ? null : amount / 100,
    currencyCode,
    categoryIds: product.categories.flatMap((category) => category.id ? [category.id] : []),
    categoryHandles: product.categories.flatMap((category) => category.handle ? [category.handle] : []),
    categoryLabels: product.categories.flatMap((category) => category.name ? [category.name] : []),
    sizeLabel: labels.size,
    colorLabel: labels.color,
    matrixSizes: sizes.length ? sizes : [labels.size],
    matrixColors: colors.length ? colors : [labels.color],
    shopVariantOptionsReady: product.options.some((option) => option.title?.toLowerCase() === "size") && product.options.some((option) => option.title?.toLowerCase() === "color"),
    stockQuantity: variants.length === 1 ? variantStockRows[0]?.stockedQuantity ?? null : null,
    variantStockRows,
    variantBarcode: first?.barcode?.trim() || null,
    storefrontMetadata: metadata,
    variantSummaries: variants.length > 1 ? variants.map((variant) => ({ id: variant.id, sku: variant.sku ?? null, title: variant.title ?? undefined })) : undefined,
    variantSellPriceSignature: sellSignature,
    variantCompareAtSignature: compareSignature,
    editorialSurfaceSignature,
    storefrontMetadataSignature,
    revision: product.updated_at,
  };
}

/** Store currency is currently PHP; catalog details use their persisted price currency. */
export async function getCatalogPriceCurrencyCode(): Promise<string> {
  return "php";
}

export async function fetchCatalogProductDetail(productId: string): Promise<CatalogProductDetail | null> {
  return mapWorkerCatalogProductDetail(await fetchWorkerCatalogProductDetailForAdmin(productId));
}
