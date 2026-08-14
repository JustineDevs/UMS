import { medusaProductRawHasSellableVariant } from "./medusa-catalog-mapper";
import type { createStorefrontMedusaSdk } from "./medusa-sdk";
import { getMedusaSalesChannelId, withSalesChannelId } from "./storefront-medusa-env";

/** Minimal fields to evaluate sellability (matches storefront catalog stock rules). */
export const MEDUSA_PRODUCT_STOCK_FIELDS =
  "id,*variants";

type StorefrontSdk = ReturnType<typeof createStorefrontMedusaSdk>;

/**
 * Paginates Store `product.list` and counts products with at least one sellable variant.
 * Caps work with `maxScan` (max raw rows inspected, not product count).
 */
export async function countSellableProductsInStoreList(
  sdk: StorefrontSdk,
  regionId: string,
  options: {
    categoryId?: string;
    maxScan?: number;
    pageSize?: number;
    allowSalesChannelFallback?: boolean;
  } = {},
): Promise<number> {
  const maxScan = options.maxScan ?? 5000;
  const pageSize = options.pageSize ?? 100;
  const allowSalesChannelFallback = options.allowSalesChannelFallback ?? true;

  async function scan(allowSalesChannel: boolean): Promise<number> {
    let count = 0;
    let offset = 0;
    while (offset < maxScan) {
      const listParams: Record<string, unknown> = {
        region_id: regionId,
        limit: pageSize,
        offset,
        fields: MEDUSA_PRODUCT_STOCK_FIELDS,
      };
      if (options.categoryId) {
        listParams.category_id = options.categoryId;
      }

      const { products } = await sdk.store.product.list(
        (allowSalesChannel && getMedusaSalesChannelId()
          ? withSalesChannelId(listParams)
          : listParams) as Parameters<typeof sdk.store.product.list>[0],
      );

      for (const p of products ?? []) {
        if (medusaProductRawHasSellableVariant(p as never)) {
          count += 1;
        }
      }

      offset += pageSize;
      if (!products?.length || products.length < pageSize) {
        break;
      }
    }
    return count;
  }

  const primary = await scan(true);
  if (primary > 0 || !allowSalesChannelFallback || !getMedusaSalesChannelId()) {
    return primary;
  }
  return scan(false);
}
