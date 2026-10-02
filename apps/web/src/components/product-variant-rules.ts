import type { Product, ProductVariant } from "@universal-music-store/types";

export function isVariantSellable(variant: ProductVariant | undefined): boolean {
  if (!variant || !variant.isActive) return false;
  return !variant.manageInventory || variant.inventoryQuantity === null || variant.inventoryQuantity > 0;
}

export function findSellableVariantForOptions(product: Product, options: { type?: string; finish?: string }): ProductVariant | undefined {
  return product.variants.find((candidate) =>
    isVariantSellable(candidate) &&
    (options.type === undefined || candidate.type === options.type) &&
    (options.finish === undefined || candidate.finish === options.finish),
  );
}
