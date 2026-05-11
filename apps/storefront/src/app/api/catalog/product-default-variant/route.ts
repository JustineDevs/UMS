import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";

export const dynamic = "force-dynamic";

/**
 * Returns the default (first active) variant id for a product.
 * Used by the wishlist "Add to bag" button to resolve the variant without
 * navigating to the product detail page.
 *
 * Query params (at least one required):
 *   ?productId=<medusa product id>
 *   ?slug=<product handle/slug>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId")?.trim();
  const slug = url.searchParams.get("slug")?.trim();

  if (!productId && !slug) {
    return Response.json({ error: "productId or slug required" }, { status: 400 });
  }

  try {
    const sdk = createStorefrontMedusaSdk();

    let variants: Array<{ id: string; manage_inventory?: boolean; inventory_quantity?: number | null }> = [];

    if (productId) {
      const { product } = await sdk.store.product.retrieve(productId, {
        fields: "id,variants.id,variants.manage_inventory,variants.inventory_quantity",
      });
      variants = (product?.variants ?? []) as typeof variants;
    } else if (slug) {
      const { products } = await sdk.store.product.list({
        handle: slug,
        fields: "id,variants.id,variants.manage_inventory,variants.inventory_quantity",
      });
      const p = products?.[0];
      variants = (p?.variants ?? []) as typeof variants;
    }

    if (!variants.length) {
      return Response.json({ error: "Product not found or has no variants" }, { status: 404 });
    }

    // Prefer first in-stock variant, fall back to first variant.
    const inStock = variants.find((v) => {
      if (!v.manage_inventory) return true;
      return (v.inventory_quantity ?? 0) > 0;
    });

    const chosen = inStock ?? variants[0];
    return Response.json({ variantId: chosen.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve variant";
    return Response.json({ error: msg }, { status: 502 });
  }
}
