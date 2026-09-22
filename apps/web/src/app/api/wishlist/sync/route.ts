import { applyRateLimit } from "@/lib/cart-api-helpers";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { isSameOriginMutation } from "@/lib/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { wishlistSyncRequestSchema, wishlistSyncResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";
const MAX_WISHLIST_BODY_BYTES = 64 * 1024;
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return json({ error: "Cross-site mutation rejected" }, 403);
  const rl = await applyRateLimit(request, "wishlist-sync", 10, 60_000); if (!rl.ok) return rl.response;
  const body = await parseBoundedJson(request, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistSyncRequestSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid saved items" }, 400);
  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return json({ error: "Saved items are not configured", code: "WORKER_API_URL_MISSING" }, 503);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return json({ error: "Not authenticated" }, 401);
  try {
    const response = await fetch(`${baseUrl}/store/wishlist/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": `storefront-wishlist-sync-${crypto.randomUUID()}` },
      body: JSON.stringify(parsed.data), cache: "no-store",
    });
    const payload = await readResponseJson(response, { error: "invalid_worker_response" });
    if (!response.ok) return json(payload, response.status);
    const validated = wishlistSyncResponseSchema.safeParse(payload);
    if (!validated.success) return json({ error: "Invalid wishlist response", code: "WORKER_RESPONSE_INVALID" }, 502);
    return json(validated.data, response.status);
  } catch { return json({ error: "Unable to synchronize saved items" }, 503); }
}
