import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { fetchProductById } from "@/lib/catalog-medusa-fetch";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { resolveWishlistCustomerId } from "@/lib/wishlist-auth";

export const dynamic = "force-dynamic";

const wishlistIdentitySchema = z.object({
  medusaProductId: z.string().trim().min(1).max(200),
}).strict();
const MAX_WISHLIST_BODY_BYTES = 16 * 1024;

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

/**
 * GET /api/wishlist
 * Returns the server-side wishlist for the authenticated customer.
 */
export async function GET(_req: Request) {
  const session = await getStorefrontSession();
  const customerId = await resolveWishlistCustomerId(session);
  if (!session?.user || !customerId?.trim()) {
    return json({ error: "Not authenticated" }, 401);
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) return json({ error: "Database unavailable" }, 503);

  const { data } = await sb
    .from("wishlists")
    .select("product_slug, product_name, medusa_product_id, added_at")
    .eq("medusa_customer_id", customerId.trim())
    .order("added_at", { ascending: false })
    .limit(200);

  const items = await Promise.all((data ?? []).map(async (item) => {
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
  return json({ items: items.filter(Boolean) });
}

/**
 * POST /api/wishlist
 * Adds a product to the server-side wishlist (upsert).
 * Body: { medusaProductId: string }
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const rl = await applyRateLimit(req, "wishlist-add", 60, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getStorefrontSession();
  const customerId = await resolveWishlistCustomerId(session);
  if (!session?.user || !customerId?.trim()) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await parseBoundedJson(req, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistIdentitySchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid wishlist item" }, 400);
  const productId = parsed.data.medusaProductId;
  const product = await fetchProductById(productId);
  if (product.kind !== "ok") return json({ error: "Product not found" }, 404);

  const sb = createStorefrontServiceSupabase();
  if (!sb) return json({ error: "Database unavailable" }, 503);

  const { data: existing, error: existingError } = await sb
    .from("wishlists")
    .select("id")
    .eq("medusa_customer_id", customerId.trim())
    .eq("medusa_product_id", product.product.id)
    .maybeSingle();
  if (existingError) return json({ error: "Unable to update saved items" }, 503);

  const { error } = existing
    ? await sb.from("wishlists").update({
        product_slug: product.product.slug,
        product_name: product.product.name,
        medusa_product_id: product.product.id,
        added_at: new Date().toISOString(),
      }).eq("id", existing.id)
    : await sb.from("wishlists").upsert({
    medusa_customer_id: customerId.trim(),
    product_slug: product.product.slug,
    product_name: product.product.name,
    medusa_product_id: product.product.id,
  }, { onConflict: "medusa_customer_id,medusa_product_id" });

  if (error) {
    return json(
      { error: "Unable to update saved items" },
      /not found|missing|does not exist/i.test(error.message) ? 404 : 503,
    );
  }
  return json({ ok: true });
}

/**
 * DELETE /api/wishlist
 * Removes a product from the server-side wishlist.
 * Body: { medusaProductId: string }
 */
export async function DELETE(req: Request) {
  if (!isSameOriginMutation(req)) return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const rl = await applyRateLimit(req, "wishlist-remove", 60, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getStorefrontSession();
  const customerId = await resolveWishlistCustomerId(session);
  if (!session?.user || !customerId?.trim()) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await parseBoundedJson(req, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistIdentitySchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid wishlist item" }, 400);
  const productId = parsed.data.medusaProductId;

  const sb = createStorefrontServiceSupabase();
  if (!sb) return json({ error: "Database unavailable" }, 503);

  const { data, error } = await sb
    .from("wishlists")
    .delete()
    .eq("medusa_customer_id", customerId.trim())
    .eq("medusa_product_id", productId)
    .select("product_slug");

  if (error) return json({ error: "Unable to update saved items" }, 503);

  return json({ ok: true, removed: (data ?? []).length > 0 });
}
