import { NextResponse } from "next/server";

import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import { withBotIdProtection } from "@/lib/botid-protection";
import {
  applyRateLimit,
  parseJsonBody,
  isValidCartId,
  writeCartCookie,
} from "@/lib/cart-api-helpers";

async function handlePOST(req: Request) {
  const rl = await applyRateLimit(req, "cart-bind", 40, 60_000);
  if (!rl.ok) return rl.response;

  const parsed = await parseJsonBody<{ cartId?: string }>(req);
  if (!parsed.ok) return parsed.response;

  const cartId = typeof parsed.data.cartId === "string" ? parsed.data.cartId.trim() : "";
  if (!isValidCartId(cartId)) {
    return NextResponse.json({ error: "cartId required" }, { status: 400 });
  }

  try {
    const sdk = createStorefrontMedusaSdk();
    await sdk.store.cart.retrieve(cartId, { fields: "id" } as never);
  } catch {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }

  await writeCartCookie(cartId);

  return NextResponse.json({ ok: true });
}

export const POST = withBotIdProtection(handlePOST);
