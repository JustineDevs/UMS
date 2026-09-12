import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { applyRateLimit } from "@/lib/cart-api-helpers";
import { fetchProductById } from "@/lib/catalog-medusa-fetch";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { resolveWishlistCustomerId } from "@/lib/wishlist-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function workerBaseUrl(): string | null {
  const value = process.env.API_URL?.trim().replace(/\/$/, "");
  return value || null;
}

async function workerAuthHeaders(): Promise<Headers | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return null;
  return new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });
}

async function proxyWorkerWishlist(
  request: Request,
  body?: string,
): Promise<Response> {
  const baseUrl = workerBaseUrl();
  if (!baseUrl) throw new Error("worker_api_not_configured");
  const headers = await workerAuthHeaders();
  if (!headers) return json({ error: "Not authenticated" }, 401);
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("Idempotency-Key", `storefront-wishlist-${crypto.randomUUID()}`);
  }
  const response = await fetch(`${baseUrl}/store/wishlist`, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({ error: "invalid_worker_response" }));
  return json(payload, response.status);
}

/**
 * GET /api/wishlist
 * Returns the server-side wishlist for the authenticated customer.
 */
export async function GET(_req: Request) {
  if (workerBaseUrl()) {
    try {
      return await proxyWorkerWishlist(_req);
    } catch (error) {
      const correlationId = crypto.randomUUID();
      console.error("Worker wishlist read failed", { correlationId, error: error instanceof Error ? error.message : "unknown" });
      return json({ error: "Saved items are temporarily unavailable", correlationId }, 503);
    }
  }
  const session = await getStorefrontSession();
  const customerId = await resolveWishlistCustomerId(session);
  if (!session?.user || !customerId?.trim()) {
    return json({ error: "Not authenticated" }, 401);
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) return json({ error: "Database unavailable" }, 503);

  const { data, error } = await sb
    .from("wishlists")
    .select("product_slug, product_name, medusa_product_id, added_at")
    .eq("medusa_customer_id", customerId.trim())
    .order("added_at", { ascending: false })
    .limit(200);
  if (error) return json({ error: "Saved items are temporarily unavailable" }, 503);

  const resolved = await Promise.all((data ?? []).map(async (item) => {
    const productId = typeof item.medusa_product_id === "string" ? item.medusa_product_id.trim() : "";
    if (!productId) return null;
    try {
      const product = await fetchProductById(productId);
      if (product.kind === "not_found") return null;
      if (product.kind !== "ok") return { kind: "unavailable" as const };
      return {
        kind: "item" as const,
        item: {
          product_slug: product.product.slug,
          product_name: product.product.name,
          medusa_product_id: product.product.id,
          added_at: item.added_at,
        },
      };
    } catch {
      return { kind: "unavailable" as const };
    }
  }));
  if (resolved.some((result) => result?.kind === "unavailable")) {
    return json({ error: "Saved items are temporarily unavailable" }, 503);
  }
  return json({
    items: resolved.flatMap((result) => result?.kind === "item" ? [result.item] : []),
  });
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
  if (workerBaseUrl()) {
    try {
      return await proxyWorkerWishlist(req, JSON.stringify(parsed.data));
    } catch (error) {
      const correlationId = crypto.randomUUID();
      console.error("Worker wishlist add failed", { correlationId, error: error instanceof Error ? error.message : "unknown" });
      return json({ error: "Unable to update saved items", correlationId }, 503);
    }
  }
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
  if (workerBaseUrl()) {
    try {
      return await proxyWorkerWishlist(req, JSON.stringify(parsed.data));
    } catch (error) {
      const correlationId = crypto.randomUUID();
      console.error("Worker wishlist remove failed", { correlationId, error: error instanceof Error ? error.message : "unknown" });
      return json({ error: "Unable to update saved items", correlationId }, 503);
    }
  }
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
