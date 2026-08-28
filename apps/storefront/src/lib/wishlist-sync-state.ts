import type { WishlistEntry } from "./wishlist";

export function isExpectedWishlistSyncUnauthorized(status: number): boolean {
  return status === 401;
}

export type WishlistSyncResultItem = {
  slug: string;
  name: string;
  medusaProductId?: string | null;
  addedAt: string;
};

/** Keep local entries that the server could not safely canonicalize. */
export function mergeWishlistSyncResult(
  localItems: readonly WishlistEntry[],
  serverItems: readonly WishlistSyncResultItem[],
  skippedProductIds: readonly string[],
): WishlistEntry[] {
  const skipped = new Set(skippedProductIds.map((id) => id.trim()).filter(Boolean));
  const merged: WishlistEntry[] = serverItems.map((item) => ({
    slug: item.slug,
    name: item.name,
    ...(item.medusaProductId?.trim() ? { medusaProductId: item.medusaProductId.trim() } : {}),
    addedAt: item.addedAt,
  }));
  const knownIds = new Set(merged.map((item) => item.medusaProductId).filter(Boolean));
  const knownSlugs = new Set(merged.map((item) => item.slug));

  for (const item of localItems) {
    const productId = item.medusaProductId?.trim();
    if (productId && !skipped.has(productId)) continue;
    if ((productId && knownIds.has(productId)) || knownSlugs.has(item.slug)) continue;
    merged.push(item);
  }

  return merged;
}
