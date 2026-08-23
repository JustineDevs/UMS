import { NextResponse } from "next/server";

import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import { withBotIdProtection } from "@/lib/botid-protection";
import {
  applyRateLimit,
  parseJsonBody,
  isValidCartId,
  readCartIdFromCookie,
  writeCartCookie,
} from "@/lib/cart-api-helpers";
import { validateCartSessionBinding } from "@/lib/cart-session-boundary";
import { cookies } from "next/headers";
import { verifyCartBindToken } from "@/lib/cart-session-boundary";
import { isSameOriginMutation } from "@/lib/request-origin";

async function handlePOST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const rl = await applyRateLimit(req, "cart-bind", 40, 60_000);
  if (!rl.ok) return rl.response;

  const parsed = await parseJsonBody<{ cartId?: string; bindToken?: string }>(req);
  if (!parsed.ok) return parsed.response;

  const cartId = typeof parsed.data.cartId === "string" ? parsed.data.cartId.trim() : "";
  if (!isValidCartId(cartId)) {
    return NextResponse.json({ error: "cartId required" }, { status: 400 });
  }

  const cookieCartId = await readCartIdFromCookie();
  const bindCookie = (await cookies()).get("cart_bind_nonce")?.value ?? "";
  const bindToken = typeof parsed.data.bindToken === "string" ? parsed.data.bindToken : "";
  const hasValidBindProof =
    Boolean(bindCookie && bindCookie === bindToken && verifyCartBindToken(bindToken));
  const ownership = validateCartSessionBinding(cartId, cookieCartId, hasValidBindProof);
  if (!cookieCartId && !hasValidBindProof) {
    return NextResponse.json({ error: "Cart ownership could not be verified" }, { status: 403 });
  }
  if (ownership.status !== 200) {
    return NextResponse.json(ownership.body, { status: ownership.status });
  }

  try {
    const sdk = createStorefrontMedusaSdk();
    const { cart } = await sdk.store.cart.retrieve(cartId, { fields: "id,+metadata" } as never);
    const metadataToken = (cart as { metadata?: Record<string, unknown> }).metadata
      ?.uvs_cart_bind_token;
    if ((!cookieCartId || cookieCartId !== cartId) && metadataToken !== bindToken) {
      return NextResponse.json({ error: "Cart ownership could not be verified" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }

  await writeCartCookie(cartId);

  // A bind proof is single-use. Existing-cart requests do not need it because
  // the HttpOnly cart cookie is the ongoing ownership boundary.
  const jar = await cookies();
  jar.delete("cart_bind_nonce");

  return NextResponse.json({ ok: true });
}

export const POST = withBotIdProtection(handlePOST);
