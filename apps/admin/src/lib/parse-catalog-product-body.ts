import type { CatalogProductMetadataFields } from "@/lib/catalog-product-metadata";
import { z } from "zod";

const CATALOG_PRODUCT_KEYS = new Set([
  "title",
  "handle",
  "description",
  "status",
  "pricePhp",
  "sku",
  "imageUrls",
  "thumbnail",
  "categoryIds",
  "sizeLabel",
  "colorLabel",
  "sizeLabels",
  "colorLabels",
  "stockQuantity",
  "stockedQuantity",
  "delta",
  "expectedStockedQuantity",
  "variantStocks",
  "matrixCellStocks",
  "variantBarcode",
  "storefrontMetadata",
  "expected_revision",
]);

const STOREFRONT_METADATA_KEYS = new Set([
  "brand",
  "videoUrl",
  "galleryVideoUrlsText",
  "weightKg",
  "dimensionsLabel",
  "material",
  "lifestyleImageUrl",
  "seoDescription",
  "relatedHandlesText",
  "hotspotsJson",
]);

const URL_FIELDS = new Set(["thumbnail", "lifestyleImageUrl", "videoUrl"]);

function isSafeAssetUrl(value: string): boolean {
  if (value.startsWith("/")) return true;
  if (value.startsWith("data:image/")) return value.length <= 2_000_000;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function addStringIssue(
  ctx: z.RefinementCtx,
  body: Record<string, unknown>,
  key: string,
  max: number,
) {
  const value = body[key];
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || value.length > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message: `${key} is invalid or too long.`,
    });
  }
  if (
    typeof value === "string" &&
    URL_FIELDS.has(key) &&
    value &&
    !isSafeAssetUrl(value)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message: `${key} must be an http(s), site-relative, or supported image data URL.`,
    });
  }
}

function addNumericIssue(
  ctx: z.RefinementCtx,
  body: Record<string, unknown>,
  key: string,
  max: number,
) {
  const value = body[key];
  if (value === undefined || value === null || value === "") return;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message: `${key} must be a finite non-negative number within the allowed range.`,
    });
  }
}

export const catalogProductRequestSchema = z
  .record(z.string(), z.unknown())
  .superRefine((body, ctx) => {
    for (const key of Object.keys(body)) {
      if (!CATALOG_PRODUCT_KEYS.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.unrecognized_keys, keys: [key] });
      }
    }
    addStringIssue(ctx, body, "title", 500);
    addStringIssue(ctx, body, "handle", 200);
    addStringIssue(ctx, body, "description", 50_000);
    addStringIssue(ctx, body, "sku", 120);
    addStringIssue(ctx, body, "variantBarcode", 120);
    addStringIssue(ctx, body, "expected_revision", 200);
    addStringIssue(ctx, body, "thumbnail", 2_000_000);
    addNumericIssue(ctx, body, "pricePhp", 100_000_000);
    addNumericIssue(ctx, body, "stockQuantity", 10_000_000);

    if (
      body.status !== undefined &&
      body.status !== "draft" &&
      body.status !== "published"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "status must be draft or published.",
      });
    }

    for (const key of [
      "imageUrls",
      "sizeLabels",
      "colorLabels",
      "categoryIds",
    ] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (!Array.isArray(value) || value.length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be an array with at most 80 entries.`,
        });
        continue;
      }
      value.forEach((item, index) => {
        if (
          typeof item !== "string" ||
          item.trim().length === 0 ||
          item.length > 2_000
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key, index],
            message: `${key} contains an invalid value.`,
          });
        } else if (key === "imageUrls" && !isSafeAssetUrl(item.trim())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key, index],
            message:
              "Media URLs must use http(s), a site-relative path, or a supported image data URL.",
          });
        }
      });
    }

    for (const [key, allowedKeys] of [
      ["variantStocks", ["variantId", "quantity"]],
      ["matrixCellStocks", ["sizeLabel", "colorLabel", "quantity"]],
    ] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (!Array.isArray(value) || value.length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be an array with at most 80 entries.`,
        });
        continue;
      }
      value.forEach((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key, index],
            message: `${key} contains an invalid entry.`,
          });
          return;
        }
        for (const nestedKey of Object.keys(item)) {
          if (!allowedKeys.includes(nestedKey as never)) {
            ctx.addIssue({
              code: z.ZodIssueCode.unrecognized_keys,
              path: [key, index],
              keys: [nestedKey],
            });
          }
        }
      });
    }

    const metadata = body.storefrontMetadata;
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["storefrontMetadata"],
          message: "storefrontMetadata must be an object.",
        });
      } else {
        const record = metadata as Record<string, unknown>;
        for (const key of Object.keys(record)) {
          if (!STOREFRONT_METADATA_KEYS.has(key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.unrecognized_keys,
              path: ["storefrontMetadata"],
              keys: [key],
            });
          }
        }
        for (const key of [
          "brand",
          "galleryVideoUrlsText",
          "dimensionsLabel",
          "material",
          "seoDescription",
          "relatedHandlesText",
          "hotspotsJson",
        ] as const) {
          const value = record[key];
          if (
            value !== undefined &&
            value !== null &&
            (typeof value !== "string" || value.length > 50_000)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["storefrontMetadata", key],
              message: `${key} is invalid or too long.`,
            });
          }
        }
        for (const key of ["videoUrl", "lifestyleImageUrl"] as const) {
          const value = record[key];
          if (
            value !== undefined &&
            value !== null &&
            (typeof value !== "string" ||
              value.length > 2_000 ||
              (value && !isSafeAssetUrl(value)))
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["storefrontMetadata", key],
              message: `${key} must be a safe asset URL.`,
            });
          }
        }
        addNumericIssue(ctx, record, "weightKg", 10_000);
      }
    }
  });

function strOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Parses `storefrontMetadata` from admin catalog API JSON body.
 */
export function parseStorefrontMetadataFromBody(
  body: Record<string, unknown>,
): CatalogProductMetadataFields | undefined {
  const raw = body.storefrontMetadata;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  return {
    brand: strOrUndef(o.brand) ?? null,
    videoUrl: strOrUndef(o.videoUrl) ?? null,
    galleryVideoUrlsText: strOrUndef(o.galleryVideoUrlsText) ?? "",
    weightKg: numOrUndef(o.weightKg) ?? null,
    dimensionsLabel: strOrUndef(o.dimensionsLabel) ?? null,
    material: strOrUndef(o.material) ?? null,
    lifestyleImageUrl: strOrUndef(o.lifestyleImageUrl) ?? null,
    seoDescription: strOrUndef(o.seoDescription) ?? null,
    relatedHandlesText: strOrUndef(o.relatedHandlesText) ?? "",
    hotspotsJson: strOrUndef(o.hotspotsJson) ?? "",
  };
}

export function parseVariantBarcodeFromBody(
  body: Record<string, unknown>,
): string | null | undefined {
  if (!("variantBarcode" in body)) return undefined;
  const v = body.variantBarcode;
  if (v === null) return null;
  if (typeof v !== "string") return null;
  return v;
}
