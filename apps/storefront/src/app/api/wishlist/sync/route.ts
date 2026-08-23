import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { fetchProductById } from "@/lib/catalog-medusa-fetch";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { resolveWishlistCustomerId } from "@/lib/wishlist-auth";

export const dynamic = "force-dynamic";

const syncSchema = z.object({
  items: z.array(z.object({ medusaProductId: z.string().trim().min(1).max(200) }).strict()).max(200),
}).strict();
const MAX_WISHLIST_BODY_BYTES = 64 * 1024;

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/**
 * POST /api/wishlist/sync
 * Merges a batch of localStorage wishlist items into the server-side table.
 * Called once on sign-in from the WishlistSyncOnLogin client component.
 * Ignores entries that already exist (upsert conflict = skip).
 * Returns the full server wishlist after merge.
 *
 * Body: { items: WishlistEntry[] }
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) return json({ error: "Cross-site mutation rejected" }, 403);
  const rl = await applyRateLimit(req, "wishlist-sync", 10, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getStorefrontSession();
  const customerId = await resolveWishlistCustomerId(session);
  if (!session?.user || !customerId?.trim()) {
    return json({ error: "Not authenticated" }, 401);
  }

  const body = await parseBoundedJson(req, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = syncSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid saved items" }, 400);
  const resolved = await Promise.all(
    parsed.data.items.map(async ({ medusaProductId }) => {
      const product = await fetchProductById(medusaProductId);
      return { medusaProductId, result: product };
    }),
  );

  if (resolved.some(({ result }) => result.kind === "service_error" || result.kind === "misconfigured")) {
    return json({ error: "Catalog unavailable. Saved items were not changed. Please retry." }, 503);
  }
  const products = resolved
    .map(({ result }) => result.kind === "ok" ? result.product : null)
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
  const skippedProductIds = resolved
    .filter(({ result }) => result.kind !== "ok")
    .map(({ medusaProductId }) => medusaProductId);

  const sb = createStorefrontServiceSupabase();
  if (!sb) return json({ error: "Database unavailable" }, 503);

  if (products.length > 0) {
    const rows = products.filter((product): product is NonNullable<typeof product> => Boolean(product)).map((product) => ({
      medusa_customer_id: customerId!.trim(),
      product_slug: product.slug,
      product_name: product.name,
      medusa_product_id: product.id,
      added_at: new Date().toISOString(),
    }));

    const { error } = await sb
      .from("wishlists")
      .upsert(rows, {
        onConflict: "medusa_customer_id,medusa_product_id",
        ignoreDuplicates: true,
      });

    if (error) {
      return json(
        { error: "Unable to synchronize saved items" },
        /not found|missing|does not exist/i.test(error.message) ? 404 : 503,
      );
    }
  }

  const { data: serverItems, error: readError } = await sb
    .from("wishlists")
    .select("product_slug,medusa_product_id,added_at")
    .eq("medusa_customer_id", customerId.trim())
    .order("added_at", { ascending: false })
    .limit(200);

  if (readError) return json({ error: "Unable to read saved items" }, 503);
  const canonicalItems = await Promise.all((serverItems ?? []).map(async (item) => {
    const productId = typeof item.medusa_product_id === "string" ? item.medusa_product_id.trim() : "";
    if (!productId) return null;
    const product = await fetchProductById(productId);
    if (product.kind !== "ok") return null;
    return {
      product_slug: product.product.slug,
      product_name: product.product.name,
      medusa_product_id: product.product.id,
      added_at: item.added_at,
    };
  }));

  return json({
    ok: true,
    items: canonicalItems.filter(Boolean),
    skippedProductIds,
  });
}
