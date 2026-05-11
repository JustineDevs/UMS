import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";

export const dynamic = "force-dynamic";

type WishlistRow = {
  product_slug: string;
  product_name: string;
  medusa_product_id?: string | null;
  added_at: string;
};

/**
 * GET /api/wishlist
 * Returns the server-side wishlist for the authenticated customer.
 */
export async function GET(req: Request) {
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

  return Response.json({ items: data ?? [] });
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

  const body = await req.json().catch(() => ({})) as {
    slug?: string;
    name?: string;
    medusaProductId?: string;
  };
  const slug = body.slug?.trim();
  const name = body.name?.trim();
  if (!slug || !name) {
    return Response.json({ error: "slug and name required" }, { status: 400 });
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Database unavailable" }, { status: 503 });

  const { error } = await sb.from("wishlists").upsert({
    medusa_customer_id: customerId.trim(),
    product_slug: slug,
    product_name: name,
    medusa_product_id: body.medusaProductId?.trim() ?? null,
  }, { onConflict: "medusa_customer_id,product_slug" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
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

  const body = await req.json().catch(() => ({})) as { slug?: string };
  const slug = body.slug?.trim();
  if (!slug) {
    return Response.json({ error: "slug required" }, { status: 400 });
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Database unavailable" }, { status: 503 });

  await sb
    .from("wishlists")
    .delete()
    .eq("medusa_customer_id", customerId.trim())
    .eq("product_slug", slug);

  return Response.json({ ok: true });
}
