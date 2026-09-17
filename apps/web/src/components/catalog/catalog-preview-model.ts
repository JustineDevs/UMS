import {
  inferCatalogGalleryMediaKind,
  normalizeCatalogAssetUrl,
} from "@/lib/catalog-asset-url";

type CatalogPreviewStatus = "draft" | "published";

export type CatalogPreviewModelInput = {
  title: string;
  handle: string;
  description: string;
  status: CatalogPreviewStatus;
  brand: string;
  currencyCode: string;
  pricePhp: string;
  imageUrls: string[];
  videoUrls: string[];
  categoryLabels: string[];
  sizes: string[];
  colors: string[];
};

type CatalogPreviewVariant = {
  key: string;
  size: string;
  color: string;
  label: string;
};

type CatalogPreviewMedia =
  | { kind: "image"; url: string; label: string }
  | { kind: "video"; url: string; label: string };

export type CatalogPreviewModel = {
  title: string;
  handle: string;
  description: string;
  status: CatalogPreviewStatus;
  brand: string | null;
  currencyCode: string;
  priceLabel: string;
  cardPriceLabel: string;
  media: CatalogPreviewMedia[];
  categoryLabels: string[];
  sizes: string[];
  colors: string[];
  variants: CatalogPreviewVariant[];
  defaultSize: string;
  defaultColor: string;
};

function normalizeUnique(values: string[], fallback: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  if (out.length > 0) return out;
  return [fallback];
}

function normalizeCategoryLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function formatCurrencyLabel(rawPrice: string, currencyCode: string): {
  priceLabel: string;
  cardPriceLabel: string;
} {
  const amount = Number(rawPrice);
  const normalizedCode = currencyCode.trim().toUpperCase() || "PHP";
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      priceLabel: `${normalizedCode} --`,
      cardPriceLabel: `${normalizedCode} --`,
    };
  }
  const formatted = amount.toLocaleString("en-PH", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return {
    priceLabel: `${normalizedCode} ${formatted}`,
    cardPriceLabel: `${normalizedCode} ${formatted}`,
  };
}

export function buildCatalogPreviewModel(
  input: CatalogPreviewModelInput,
): CatalogPreviewModel {
  const sizes = normalizeUnique(input.sizes, "One Size");
  const colors = normalizeUnique(input.colors, "Default");
  const variants: CatalogPreviewVariant[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      variants.push({
        key: `${size}\u0000${color}`,
        size,
        color,
        label: `${size} / ${color}`,
      });
    }
  }

  const imageMedia: CatalogPreviewMedia[] = input.imageUrls
    .map((url) => normalizeCatalogAssetUrl(url))
    .filter(Boolean)
    .map((url, index) => ({
      kind: "image" as const,
      url,
      label: `Photo ${index + 1}`,
    }));

  const galleryMedia: CatalogPreviewMedia[] = input.videoUrls
    .map((url) => normalizeCatalogAssetUrl(url))
    .filter(Boolean)
    .map((url, index) => {
      const kind = inferCatalogGalleryMediaKind(url);
      return {
        kind,
        url,
        label: `Gallery item ${index + 1}`,
      };
    });

  const media: CatalogPreviewMedia[] = [...imageMedia, ...galleryMedia];

  const { priceLabel, cardPriceLabel } = formatCurrencyLabel(
    input.pricePhp,
    input.currencyCode,
  );

  return {
    title: input.title.trim() || "Untitled product",
    handle: input.handle.trim() || "product-handle",
    description:
      input.description.trim() ||
      "Write a short description to preview how the detail page copy will read.",
    status: input.status,
    brand: input.brand.trim() || null,
    currencyCode: input.currencyCode.trim().toUpperCase() || "PHP",
    priceLabel,
    cardPriceLabel,
    media,
    categoryLabels: normalizeCategoryLabels(input.categoryLabels),
    sizes,
    colors,
    variants,
    defaultSize: sizes[0] ?? "One Size",
    defaultColor: colors[0] ?? "Default",
  };
}
