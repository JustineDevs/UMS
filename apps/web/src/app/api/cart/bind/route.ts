import { NextResponse } from "next/server";
import {
  applyRateLimit,
  parseJsonBody,
  isValidCartId,
  readCartIdFromCookie,
  writeCartCookie,
} from "@/lib/cart-api-helpers";
import { validateCartSessionBinding, verifyCartBindToken } from "@/lib/cart-session-boundary";
import { cookies } from "next/headers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readResponseJson } from "@/lib/read-response-json";
import { cartBindResponseSchema } from "@/lib/admin-api-contracts";

async function handlePOST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const rateLimit = await applyRateLimit(req, "cart-bind", 40, 60_000);
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = await parseJsonBody<{ cartId?: string; bindToken?: string }>(req);
  if (!parsed.ok) return parsed.response;
  const cartId = typeof parsed.data.cartId === "string" ? parsed.data.cartId.trim() : "";
  if (!isValidCartId(cartId)) return NextResponse.json({ error: "cartId required" }, { status: 400 });

  const jar = await cookies();
  const cookieCartId = await readCartIdFromCookie();
  const bindCookie = jar.get("cart_bind_nonce")?.value ?? "";
  const bindToken = typeof parsed.data.bindToken === "string" ? parsed.data.bindToken : "";
  const hasValidBindProof = Boolean(bindCookie && bindCookie === bindToken && verifyCartBindToken(bindToken));
  const ownership = validateCartSessionBinding(cartId, cookieCartId, hasValidBindProof);
  if (!cookieCartId && !hasValidBindProof) {
    return NextResponse.json({ error: "Cart ownership could not be verified" }, { status: 403 });
  }
  if (ownership.status !== 200) return NextResponse.json(ownership.body, { status: ownership.status });

  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ error: "Commerce Worker is unavailable" }, { status: 503 });
  try {
    const response = await fetch(`${apiUrl}/store/carts/${encodeURIComponent(cartId)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    const payload = await readResponseJson<{ cart?: { metadata?: Record<string, unknown> | null } }>(response, {});
    const metadataToken = payload.cart?.metadata?.uvs_cart_bind_token;
    if ((!cookieCartId || cookieCartId !== cartId) && metadataToken !== bindToken) {
      return NextResponse.json({ error: "Cart ownership could not be verified" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Commerce Worker is unavailable" }, { status: 503 });
  }

  await writeCartCookie(cartId);
  jar.delete("cart_bind_nonce");
  return NextResponse.json(cartBindResponseSchema.parse({ ok: true }));
}

/**
 * Reject requests that have no cart ownership proof before invoking BotId.
 * This keeps the security contract deterministic when the optional bot
 * provider is unavailable: an unowned cart is always 403, never 503.
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }

  const cookieCartId = await readCartIdFromCookie();
  const jar = await cookies();
  const bindCookie = jar.get("cart_bind_nonce")?.value ?? "";
  let bindToken = "";
  try {
    const payload = (await req.clone().json()) as { bindToken?: unknown };
    bindToken = typeof payload.bindToken === "string" ? payload.bindToken : "";
  } catch {
    // handlePOST owns the normal malformed-body response.
  }
  const hasValidBindProof = Boolean(
    bindCookie && bindCookie === bindToken && verifyCartBindToken(bindToken),
  );
  if (!cookieCartId && !hasValidBindProof) {
    return NextResponse.json(
      { error: "Cart ownership could not be verified" },
      { status: 403 },
    );
  }

  // Ownership proof, same-origin enforcement, Worker cart verification, and
  // rate limiting are the security boundary for this endpoint. Applying the
  // optional Bot ID gate here rejects legitimate hosted-checkout handoffs in
  // automated and privacy-hardened browsers after checkout has already been
  // authorized. Keep Bot ID on high-value mutations instead.
  return handlePOST(req);
}
