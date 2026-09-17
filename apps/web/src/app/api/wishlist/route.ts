import { applyRateLimit } from "@/lib/cart-api-helpers";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { isSameOriginMutation } from "@/lib/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
const wishlistIdentitySchema = z.object({ medusaProductId: z.string().trim().min(1).max(200) }).strict();
const MAX_WISHLIST_BODY_BYTES = 16 * 1024;

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
function workerBaseUrl() { return process.env.API_URL?.trim().replace(/\/$/, "") || null; }
async function workerAuthHeaders() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  return token ? new Headers({ Authorization: `Bearer ${token}`, Accept: "application/json" }) : null;
}
async function proxyWorkerWishlist(request: Request, body?: string): Promise<Response> {
  const baseUrl = workerBaseUrl();
  if (!baseUrl) return json({ error: "Saved items are not configured", code: "WORKER_API_URL_MISSING" }, 503);
  const authHeaders = await workerAuthHeaders();
  if (!authHeaders) return json({ error: "Not authenticated" }, 401);
  const headers = new Headers(authHeaders);
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("Idempotency-Key", `storefront-wishlist-${crypto.randomUUID()}`);
  }
  try {
    const response = await fetch(`${baseUrl}/store/wishlist`, { method: request.method, headers, body, cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "invalid_worker_response" }));
    return json(payload, response.status);
  } catch { return json({ error: "Saved items are temporarily unavailable" }, 503); }
}
export async function GET(request: Request) { return proxyWorkerWishlist(request); }
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return json({ error: "Cross-site mutation rejected" }, 403);
  const rl = await applyRateLimit(request, "wishlist-add", 60, 60_000); if (!rl.ok) return rl.response;
  const body = await parseBoundedJson(request, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistIdentitySchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid wishlist item" }, 400);
  return proxyWorkerWishlist(request, JSON.stringify(parsed.data));
}
export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return json({ error: "Cross-site mutation rejected" }, 403);
  const rl = await applyRateLimit(request, "wishlist-remove", 60, 60_000); if (!rl.ok) return rl.response;
  const body = await parseBoundedJson(request, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistIdentitySchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid wishlist item" }, 400);
  return proxyWorkerWishlist(request, JSON.stringify(parsed.data));
}
