import { createHash, createHmac } from "node:crypto";
import { cartMergePostBodySchema, medusaCartIdSchema } from "@universal-music-store/validation";
import { NextResponse } from "next/server";
import { getStorefrontSession, isStorefrontAuthDisabled } from "@/lib/auth";
import { applyRateLimit, readCartIdFromCookie, writeCartCookie } from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { readResponseJson } from "@/lib/read-response-json";
import { cartMergeResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";
const MAX_CART_MERGE_BODY_BYTES = 64 * 1024;

function internalStorefrontToken(userId: string, email: string): string | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || process.env.NODE_ENV === "production") return null;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: userId,
    email,
    scope: "storefront:cart-merge",
    iss: "uvs.internal",
    aud: "uvs-worker",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${createHmac("sha256", secret).update(signingInput).digest("base64url")}`;
}

async function userToken(userId: string, email: string): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (token) return token;
  } catch {
    // Auth-disabled local development uses a short-lived server-minted token below.
  }
  return isStorefrontAuthDisabled() ? internalStorefrontToken(userId, email) : null;
}

async function createWorkerCart(baseUrl: string, mergeKey: string, userId: string, staleCartId?: string): Promise<string | null> {
  const createKey = createHash("sha256").update(`${userId}:${mergeKey}:${staleCartId ?? "new"}`).digest("hex");
  const response = await fetch(`${baseUrl}/store/carts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": `cart-merge-create-${createKey}`,
    },
    body: JSON.stringify({ currency_code: "php" }),
    cache: "no-store",
  });
  const payload = await readResponseJson<{ cart?: { id?: unknown } }>(response, {});
  const parsedId = medusaCartIdSchema.safeParse(payload.cart?.id);
  return response.ok && parsedId.success ? parsedId.data : null;
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const rateLimit = await applyRateLimit(request, "cart-merge", 20, 60_000);
  if (!rateLimit.ok) return rateLimit.response;

  const session = await getStorefrontSession();
  const userId = session?.user.id?.trim();
  const email = session?.user.email?.trim().toLowerCase();
  if (!userId || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await userToken(userId, email);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bounded = await parseBoundedJson(request, MAX_CART_MERGE_BODY_BYTES);
  if (bounded.tooLarge) return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  if (!bounded.valid) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = cartMergePostBodySchema.safeParse(bounded.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const guestLines = parsed.data.guestLines ?? [];
  if (guestLines.length === 0) {
    return NextResponse.json({ error: "At least one guest cart line is required" }, { status: 400 });
  }

  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return NextResponse.json({ error: "Cart service is unavailable" }, { status: 503 });
  const mergeKey = parsed.data.mergeKey;
  const staleCartId = await readCartIdFromCookie();
  let cartId = staleCartId;
  if (!cartId) cartId = await createWorkerCart(baseUrl, mergeKey, userId);
  if (!cartId) return NextResponse.json({ error: "Cart service is unavailable" }, { status: 503 });

  try {
    const merge = (targetCartId: string) => fetch(`${baseUrl}/store/cart/merge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: targetCartId, mergeKey, guestLines }),
      cache: "no-store",
    });
    let response = await merge(cartId);
    if (response.status === 404 && staleCartId) {
      const replacement = await createWorkerCart(baseUrl, mergeKey, userId, staleCartId);
      if (!replacement) return NextResponse.json({ error: "Cart service is unavailable" }, { status: 503 });
      cartId = replacement;
      response = await merge(cartId);
    }
    const payload = await readResponseJson(response, { error: "invalid_worker_response" });
    if (!response.ok) {
      const error = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Cart merge is temporarily unavailable";
      const code = payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
        ? payload.code
        : undefined;
      return NextResponse.json({ error, ...(code ? { code } : {}) }, { status: response.status });
    }
    const validated = cartMergeResponseSchema.safeParse(payload);
    if (!validated.success || validated.data.cartId !== cartId)
      return NextResponse.json({ error: "Invalid cart merge response" }, { status: 502 });
    await writeCartCookie(cartId);
    return NextResponse.json(validated.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Cart merge is temporarily unavailable" }, { status: 503 });
  }
}
