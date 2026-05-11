import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";

export const dynamic = "force-dynamic";

type WishlistEntry = {
  slug: string;
  name: string;
  medusaProductId?: string;
  addedAt?: string;
};

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

  const body = await req.json().catch(() => ({})) as { items?: unknown[] };
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: WishlistEntry[] = [];
  for (const row of rawItems) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const slug = typeof o.slug === "string" ? o.slug.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!slug || !name) continue;
    items.push({
      slug,
      name,
      medusaProductId:
        typeof o.medusaProductId === "string" ? o.medusaProductId.trim() : undefined,
      addedAt: typeof o.addedAt === "string" ? o.addedAt : undefined,
    });
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) return Response.json({ error: "Database unavailable" }, { status: 503 });

  if (items.length > 0) {
    const rows = items.slice(0, 200).map((item) => ({
      medusa_customer_id: customerId!.trim(),
      product_slug: item.slug,
      product_name: item.name,
      medusa_product_id: item.medusaProductId ?? null,
      added_at: item.addedAt ?? new Date().toISOString(),
    }));

    const { error } = await sb
      .from("wishlists")
      .upsert(rows, {
        onConflict: "medusa_customer_id,product_slug",
        ignoreDuplicates: true,
      });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
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
