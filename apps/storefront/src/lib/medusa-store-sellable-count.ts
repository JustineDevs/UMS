import { catalogProductFromMedusaRaw } from "./medusa-catalog-mapper";
import type { createStorefrontMedusaSdk } from "./medusa-sdk";
import {
  getMedusaSalesChannelId,
  withSalesChannelId,
} from "./storefront-medusa-env";
import { fetchMedusaPages } from "./medusa-pagination";

/** Minimal fields to evaluate sellability (matches storefront catalog stock rules). */
export const MEDUSA_PRODUCT_STOCK_FIELDS = "id,*variants";

/** Uses the exact mapper used by product listings so counts and lists share one population. */
export function countSellableCatalogRows(rows: readonly unknown[]): number {
  return rows.reduce<number>(
    (count, row) =>
      row &&
      typeof row === "object" &&
      catalogProductFromMedusaRaw(row as never)
        ? count + 1
        : count,
    0 as number,
  );
}

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
    pageSize?: number;
    allowSalesChannelFallback?: boolean;
  } = {},
): Promise<number> {
  const pageSize = options.pageSize ?? 100;
  const allowSalesChannelFallback = options.allowSalesChannelFallback ?? true;

  async function scan(allowSalesChannel: boolean): Promise<number> {
    const { pages } = await fetchMedusaPages(pageSize, async (offset) => {
      const listParams: Record<string, unknown> = {
        region_id: regionId,
        limit: pageSize,
        offset,
        fields: MEDUSA_PRODUCT_STOCK_FIELDS,
      };
      if (options.categoryId) listParams.category_id = options.categoryId;

      const { products, count: total } = await sdk.store.product.list(
        (allowSalesChannel && getMedusaSalesChannelId()
          ? withSalesChannelId(listParams)
          : listParams) as Parameters<typeof sdk.store.product.list>[0],
      );
      return { rows: products ?? [], total };
    });
    return pages.reduce(
      (count, rows) => count + countSellableCatalogRows(rows),
      0,
    );
  }

  const primary = await scan(true);
  if (primary > 0 || !allowSalesChannelFallback || !getMedusaSalesChannelId()) {
    return primary;
  }
  return scan(false);
}
