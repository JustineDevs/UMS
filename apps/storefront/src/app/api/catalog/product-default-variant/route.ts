import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import { minorUnitDivisor } from "@/lib/medusa-money";

export const dynamic = "force-dynamic";

function resolveVariantErrorStatus(message: string): number {
  const m = message.toLowerCase();
  if (
    m.includes("not found") ||
    m.includes("no product") ||
    m.includes("has no variants") ||
    m.includes("variant not found")
  ) {
    return 404;
  }
  if (
    m.includes("publishable api key") ||
    m.includes("publishable key") ||
    m.includes("store publishable api key") ||
    m.includes("not configured")
  ) {
    return 503;
  }
  return 502;
}

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

    let variants: Array<{
      id: string;
      sku?: string | null;
      manage_inventory?: boolean;
      inventory_quantity?: number | null;
      calculated_price?: {
        calculated_amount?: number | null;
        currency_code?: string | null;
      } | null;
    }> = [];

    if (productId) {
      const { product } = await sdk.store.product.retrieve(productId, {
        fields: "id,variants.id,variants.sku,variants.manage_inventory,variants.calculated_price",
      });
      variants = (product?.variants ?? []) as typeof variants;
    } else if (slug) {
      const { products } = await sdk.store.product.list({
        handle: slug,
        fields: "id,variants.id,variants.sku,variants.manage_inventory,variants.calculated_price",
      });
      const p = products?.[0];
      variants = (p?.variants ?? []) as typeof variants;
    }

    if (!variants.length) {
      return Response.json({ error: "Product not found or has no variants" }, { status: 404 });
    }

    // Store API availability is scoped through the publishable key.
    // When quantity is unavailable in this scope, fall back to the first variant.
    const chosen = variants[0];
    const amount = chosen.calculated_price?.calculated_amount;
    return Response.json({
      variantId: chosen.id,
      sku: chosen.sku ?? "",
      price:
        typeof amount === "number" && Number.isFinite(amount)
          ? amount /
            minorUnitDivisor(chosen.calculated_price?.currency_code ?? "PHP")
          : null,
      currency: chosen.calculated_price?.currency_code ?? "PHP",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve variant";
    return Response.json(
      { error: "Unable to resolve product variant" },
      { status: resolveVariantErrorStatus(msg) },
    );
  }
}
