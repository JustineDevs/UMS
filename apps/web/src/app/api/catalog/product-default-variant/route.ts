import { minorUnitDivisor } from "@/lib/medusa-money";
import { readResponseJson } from "@/lib/read-response-json";
import { catalogDefaultVariantResponseSchema } from "@/lib/admin-api-contracts";

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
    const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
    if (!baseUrl) throw new Error("worker_api_not_configured");
    const endpoint = productId
      ? `${baseUrl}/store/products?id=${encodeURIComponent(productId)}&limit=1`
      : `${baseUrl}/store/products/${encodeURIComponent(slug ?? "")}`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) {
      return Response.json({ error: "Product not found or has no variants" }, { status: 404 });
    }
    if (!response.ok) throw new Error(`worker_catalog_${response.status}`);
    const payload = await readResponseJson<{
      product?: { variants?: unknown[] };
      products?: Array<{ variants?: unknown[] }>;
    }>(response, {});
    const variants = (payload.product?.variants ?? payload.products?.[0]?.variants ?? [])
      .filter((variant): variant is {
        id: string;
        sku?: string | null;
        manage_inventory?: boolean;
        calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null;
      } => Boolean(variant && typeof variant === "object" && typeof (variant as { id?: unknown }).id === "string"));

    if (!variants.length) {
      return Response.json({ error: "Product not found or has no variants" }, { status: 404 });
    }

    // Store API availability is scoped through the publishable key.
    // When quantity is unavailable in this scope, fall back to the first variant.
    const chosen = variants[0];
    const amount = chosen.calculated_price?.calculated_amount;
    return Response.json(catalogDefaultVariantResponseSchema.parse({
      variantId: chosen.id,
      sku: chosen.sku ?? "",
      price:
        typeof amount === "number" && Number.isFinite(amount)
          ? amount /
            minorUnitDivisor(chosen.calculated_price?.currency_code ?? "PHP")
          : null,
      currency: chosen.calculated_price?.currency_code ?? "PHP",
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve variant";
    return Response.json(
      { error: "Unable to resolve product variant" },
      { status: resolveVariantErrorStatus(msg) },
    );
  }
}
