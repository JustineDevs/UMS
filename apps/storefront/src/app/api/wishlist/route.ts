import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { fetchProductBySlug } from "@/lib/catalog-medusa-fetch";
import { z } from "zod";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  slug: z.string().trim().min(1).max(200),
}).strict();

const removeSchema = z.object({ slug: z.string().trim().min(1).max(200) }).strict();

/**
 * GET /api/wishlist
 * Returns the server-side wishlist for the authenticated customer.
 */
export async function GET(_req: Request) {
  const session = await getServerSession(authOptions);
  const customerId = (session?.user as Record<string, unknown> | undefined)?.medusaCustomerId as string | undefined;
  if (!session?.user || !customerId?.trim()) {
    return Response.json({ items: [] });
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ items: [] });

  const { data } = await sb
    .from("wishlists")
    .select("product_slug, product_name, medusa_product_id, added_at")
    .eq("medusa_customer_id", customerId.trim())
    .order("added_at", { ascending: false })
    .limit(200);

  const items = await Promise.all((data ?? []).map(async (item) => {
    const product = await fetchProductBySlug(String(item.product_slug));
    if (product.kind !== "ok") return null;
    return {
      product_slug: product.product.slug,
      product_name: product.product.name,
      medusa_product_id: product.product.id,
      added_at: item.added_at,
    };
  }));
  return Response.json({ items: items.filter(Boolean) });
}

/**
 * POST /api/wishlist
 * Adds a product to the server-side wishlist (upsert).
 * Body: { slug: string; name: string; medusaProductId?: string }
 */
export async function POST(req: Request) {
  const rl = await applyRateLimit(req, "wishlist-add", 60, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getServerSession(authOptions);
  const customerId = (session?.user as Record<string, unknown> | undefined)?.medusaCustomerId as string | undefined;
  if (!session?.user || !customerId?.trim()) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid wishlist item" }, { status: 400 });
  const { slug } = parsed.data;
  const product = await fetchProductBySlug(slug);
  if (product.kind !== "ok") return Response.json({ error: "Product not found" }, { status: 404 });

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Database unavailable" }, { status: 503 });

  const { error } = await sb.from("wishlists").upsert({
    medusa_customer_id: customerId.trim(),
    product_slug: slug,
    product_name: product.product.name,
    medusa_product_id: product.product.id,
  }, { onConflict: "medusa_customer_id,product_slug" });

  if (error) {
    return Response.json(
      { error: error.message },
      { status: /not found|missing|does not exist/i.test(error.message) ? 404 : 503 },
    );
  }
  return Response.json({ ok: true });
}

/**
 * DELETE /api/wishlist
 * Removes a product from the server-side wishlist.
 * Body: { slug: string }
 */
export async function DELETE(req: Request) {
  const rl = await applyRateLimit(req, "wishlist-remove", 60, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getServerSession(authOptions);
  const customerId = (session?.user as Record<string, unknown> | undefined)?.medusaCustomerId as string | undefined;
  if (!session?.user || !customerId?.trim()) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = removeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid wishlist item" }, { status: 400 });
  const { slug } = parsed.data;

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Database unavailable" }, { status: 503 });

  const { error } = await sb
    .from("wishlists")
    .delete()
    .eq("medusa_customer_id", customerId.trim())
    .eq("product_slug", slug);

  if (error) return Response.json({ error: "Unable to update saved items" }, { status: 503 });

  return Response.json({ ok: true });
}
