import { unstable_cache } from "next/cache";

import type { ProductBySlugResult } from "@/lib/catalog-fetch";
import { fetchProductBySlug } from "@/lib/catalog-fetch";

const PRODUCT_PAGE_REVALIDATE_SEC = 120;

/**
 * Cross-request cache for PDP data so Medusa is not hit on every request.
 * Inventory shown on the page can be up to this many seconds stale; checkout
 * still enforces live availability on the Medusa cart.
 */
export function getCachedProductBySlug(slug: string): Promise<ProductBySlugResult> {
  const cached = unstable_cache(
    async () => {
      const result = await fetchProductBySlug(slug);
      return result.kind === "ok" ? result.product : null;
    },
    ["storefront-product-pdp-v2", slug],
    {
      revalidate: PRODUCT_PAGE_REVALIDATE_SEC,
      tags: [`product:${slug}`],
    },
  );
  return cached().then((product) =>
    product ? { kind: "ok", product } : fetchProductBySlug(slug),
  );
}
