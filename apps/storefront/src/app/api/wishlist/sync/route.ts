import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { fetchProductBySlug } from "@/lib/catalog-medusa-fetch";
import { z } from "zod";

export const dynamic = "force-dynamic";

const syncSchema = z.object({
  items: z.array(z.object({ slug: z.string().trim().min(1).max(200) }).strict()).max(200),
}).strict();

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
  const rl = await applyRateLimit(req, "wishlist-sync", 10, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getServerSession(authOptions);
  const customerId = (session?.user as Record<string, unknown> | undefined)?.medusaCustomerId as string | undefined;
  if (!session?.user || !customerId?.trim()) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = syncSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid saved items" }, { status: 400 });
  const products = await Promise.all(
    parsed.data.items.map(async ({ slug }) => {
      const product = await fetchProductBySlug(slug);
      return product.kind === "ok" ? product.product : null;
    }),
  );

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Database unavailable" }, { status: 503 });

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
        onConflict: "medusa_customer_id,product_slug",
        ignoreDuplicates: true,
      });

    if (error) {
      return Response.json(
        { error: error.message },
        { status: /not found|missing|does not exist/i.test(error.message) ? 404 : 503 },
      );
    }
  }

  const { data: serverItems } = await sb
    .from("wishlists")
    .select("product_slug,product_name,medusa_product_id,added_at")
    .eq("medusa_customer_id", customerId.trim())
    .order("added_at", { ascending: false })
    .limit(200);

  return Response.json({ ok: true, items: serverItems ?? [] });
}
