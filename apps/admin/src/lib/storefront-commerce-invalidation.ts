import type { CatalogProductDetail } from "@/lib/medusa-catalog-service";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";

export type StorefrontCatalogMutationClassification =
  | "editorial_only"
  | "merchandising_only"
  | "sellability_affecting"
  | "checkout_affecting";

export type StorefrontCommerceInvalidationPayload = {
  scope?: "commerce" | "cms";
  classification: StorefrontCatalogMutationClassification;
  productHandles?: string[];
  productIds?: string[];
  variantIds?: string[];
  /** Medusa category handles; storefront revalidates `collection:{handle}` tags. */
  collectionHandles?: string[];
  actorEmail?: string | null;
  reason?: string;
};

export async function notifyStorefrontCmsInvalidation(input: {
  actorEmail?: string | null;
  reason?: string;
} = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  return notifyStorefrontCommerceInvalidation({
    scope: "cms",
    classification: "editorial_only",
    actorEmail: input.actorEmail,
    reason: input.reason ?? "cms_mutation",
  });
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function distinctStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))].sort();
}

function stockSignature(detail: CatalogProductDetail | null): string {
  if (!detail) return "";
  return detail.variantStockRows
    .map((row) => `${row.variantId}:${row.stockedQuantity ?? "null"}`)
    .sort()
    .join("|");
}

export function classifyCatalogMutation(
  before: CatalogProductDetail | null,
  after: CatalogProductDetail | null,
): StorefrontCatalogMutationClassification {
  if (!before || !after) return "checkout_affecting";
  if (before.variantSellPriceSignature !== after.variantSellPriceSignature) {
    return "checkout_affecting";
  }
  if (
    before.status !== after.status ||
    !arraysEqual(before.categoryIds, after.categoryIds) ||
    !arraysEqual(before.matrixSizes, after.matrixSizes) ||
    !arraysEqual(before.matrixColors, after.matrixColors) ||
    before.variantCount !== after.variantCount ||
    stockSignature(before) !== stockSignature(after)
  ) {
    return "sellability_affecting";
  }
  if (before.variantCompareAtSignature !== after.variantCompareAtSignature) {
    return "merchandising_only";
  }
  if (before.storefrontMetadataSignature !== after.storefrontMetadataSignature) {
    return "merchandising_only";
  }
  if (before.editorialSurfaceSignature !== after.editorialSurfaceSignature) {
    return "editorial_only";
  }
  return "editorial_only";
}

export function buildStorefrontCommerceInvalidationPayload(input: {
  classification: StorefrontCatalogMutationClassification;
  before?: CatalogProductDetail | null;
  after?: CatalogProductDetail | null;
  actorEmail?: string | null;
  reason?: string;
}): StorefrontCommerceInvalidationPayload {
  const beforeVariantIds = input.before?.variantStockRows.map((row) => row.variantId) ?? [];
  const afterVariantIds = input.after?.variantStockRows.map((row) => row.variantId) ?? [];
  const beforeHandles = input.before?.categoryHandles ?? [];
  const afterHandles = input.after?.categoryHandles ?? [];
  return {
    classification: input.classification,
    productHandles: distinctStrings([input.before?.handle, input.after?.handle]),
    productIds: distinctStrings([input.before?.id, input.after?.id]),
    variantIds: distinctStrings([...beforeVariantIds, ...afterVariantIds]),
    collectionHandles: distinctStrings([...beforeHandles, ...afterHandles]),
    actorEmail: input.actorEmail ?? null,
    reason: input.reason,
  };
}

export async function notifyStorefrontCommerceInvalidation(
  payload: StorefrontCommerceInvalidationPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const origin =
    process.env.STOREFRONT_ORIGIN?.trim()?.replace(/\/$/, "") ||
    getStorefrontPublicOrigin();
  const secret = process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim();
  if (!origin || !secret) {
    return {
      ok: false,
      error:
        "STOREFRONT_ORIGIN/public storefront URL and STOREFRONT_INTERNAL_INVALIDATION_SECRET must be set for storefront invalidation.",
    };
  }

  try {
    const res = await fetch(`${origin}/api/internal/invalidate-commerce-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error:
          typeof json.error === "string" && json.error.trim()
            ? json.error
            : `Storefront invalidation failed (${res.status}).`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Storefront invalidation request failed.",
    };
  }
}
