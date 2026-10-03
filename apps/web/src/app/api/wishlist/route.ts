import { applyRateLimit } from "@/lib/cart-api-helpers";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { isSameOriginMutation } from "@/lib/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorefrontSession } from "@/lib/auth";
import { getE2eSessionEmail } from "@/lib/e2e-session";
import { readResponseJson } from "@/lib/read-response-json";
import { wishlistCreateResponseSchema, wishlistDeleteResponseSchema, wishlistRequestSchema, wishlistResponseSchema } from "@/lib/admin-api-contracts";
import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";
const MAX_WISHLIST_BODY_BYTES = 16 * 1024;

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
function workerBaseUrl() { return process.env.API_URL?.trim().replace(/\/$/, "") || null; }
function internalStorefrontToken(userId: string, email: string): string | null {
  if (process.env.NODE_ENV === "production" && process.env.UVS_E2E_LOCAL !== "1") return null;
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: userId, email, scope: "storefront:wishlist", iss: "uvs.internal", aud: "uvs-worker", exp: Math.floor(Date.now() / 1000) + 60 });
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${createHmac("sha256", secret).update(signingInput).digest("base64url")}`;
}
async function workerAuthHeaders() {
  let token: string | undefined;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token?.trim();
  } catch {
    // Local E2E sessions do not create a Supabase browser session.
  }
  if (!token) {
    const session = await getStorefrontSession();
    const userId = session?.user.id?.trim();
    const email = session?.user.email?.trim().toLowerCase();
    const e2eEmail = await getE2eSessionEmail();
    const localAuthDisabled =
      process.env.NODE_ENV !== "production" &&
      (process.env.AUTH_DISABLED === "true" ||
        process.env.AUTH_DISABLE === "true" ||
        process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
        process.env.NEXT_PUBLIC_AUTH_DISABLE === "true");
    if (
      userId &&
      email &&
      (e2eEmail === email || localAuthDisabled)
    ) {
      token = internalStorefrontToken(userId, email) ?? undefined;
    }
  }
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
    if (!response.ok) return json({ error: "Saved items request failed" }, response.status);
    const payload = await readResponseJson(response, { error: "invalid_worker_response" });
    const schema = request.method === "GET" ? wishlistResponseSchema : request.method === "POST" ? wishlistCreateResponseSchema : wishlistDeleteResponseSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return json({ error: "invalid_worker_response" }, 502);
    return json(parsed.data, 200);
  } catch { return json({ error: "Saved items are temporarily unavailable" }, 503); }
}
export async function GET(request: Request) { return proxyWorkerWishlist(request); }
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return json({ error: "Cross-site mutation rejected" }, 403);
  const rl = await applyRateLimit(request, "wishlist-add", 60, 60_000); if (!rl.ok) return rl.response;
  const body = await parseBoundedJson(request, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistRequestSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid wishlist item" }, 400);
  return proxyWorkerWishlist(request, JSON.stringify(parsed.data));
}
export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return json({ error: "Cross-site mutation rejected" }, 403);
  const rl = await applyRateLimit(request, "wishlist-remove", 60, 60_000); if (!rl.ok) return rl.response;
  const body = await parseBoundedJson(request, MAX_WISHLIST_BODY_BYTES);
  if (body.tooLarge) return json({ error: "Request body too large" }, 413);
  const parsed = wishlistRequestSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return json({ error: "Invalid wishlist item" }, 400);
  return proxyWorkerWishlist(request, JSON.stringify(parsed.data));
}
