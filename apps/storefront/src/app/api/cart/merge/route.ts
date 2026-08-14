import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import type { CartLine } from "@/lib/cart";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import {
  getMedusaRegionId,
  withSalesChannelId,
} from "@/lib/storefront-medusa-env";
import { extractSessionEmail } from "@universal-music-store/sdk";
import {
  applyRateLimit,
  parseJsonBody,
  isValidCartId,
  readCartIdFromCookie,
  writeCartCookie,
  retrieveCartLines,
  retrieveCartRaw,
} from "@/lib/cart-api-helpers";
import { cartMergePostBodySchema } from "@universal-music-store/validation";

/**
 * Merges guest session lines into the customer's Medusa cart (combine quantities per variant).
 */
export async function POST(req: Request) {
  const rl = await applyRateLimit(req, "cart-merge", 20, 60_000);
  if (!rl.ok) return rl.response;

  const session = await getServerSession(authOptions);
  const email = extractSessionEmail(session);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody<unknown>(req);
  if (!parsed.ok) return parsed.response;

  const bodyParsed = cartMergePostBodySchema.safeParse(parsed.data);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: bodyParsed.error.flatten() },
      { status: 400 },
    );
  }

  const guestLines = bodyParsed.data.guestLines ?? [];
  if (guestLines.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, lines: [] as CartLine[] });
  }

  const regionId = getMedusaRegionId()?.trim();
  if (!regionId) {
    return NextResponse.json({ error: "Store region not configured" }, { status: 503 });
  }

  const sdk = createStorefrontMedusaSdk();
  let targetCartId = await readCartIdFromCookie();

  const createCart = async () => {
    const { cart: created } = await sdk.store.cart.create(
      withSalesChannelId({ region_id: regionId }) as Parameters<
        typeof sdk.store.cart.create
      >[0],
    );
    return created?.id ?? null;
  };

  if (!targetCartId) targetCartId = await createCart();

  if (!isValidCartId(targetCartId)) {
    return NextResponse.json({ error: "No target cart" }, { status: 503 });
  }

  let existing = await retrieveCartRaw(
    targetCartId,
    "*items,*items.id,*items.variant_id,*items.quantity",
  );
  if (!existing) {
    // A stale cookie is normal after a Medusa reset or cart expiry. Replace it
    // instead of turning login/cart merge into a 500.
    targetCartId = await createCart();
    if (!isValidCartId(targetCartId)) {
      return NextResponse.json({ error: "No target cart" }, { status: 503 });
    }
    existing = {};
  }
  const existingItems = (
    (existing as { items?: Array<{ id?: string; variant_id?: string; quantity?: number }> })
      ?.items ?? []
  );

  const byVariant = new Map<string, number>();
  for (const it of existingItems) {
    const vid = typeof it.variant_id === "string" ? it.variant_id : "";
    const q =
      typeof it.quantity === "number" && Number.isFinite(it.quantity)
        ? Math.max(0, Math.floor(it.quantity))
        : 0;
    if (vid && q > 0) {
      byVariant.set(vid, (byVariant.get(vid) ?? 0) + q);
    }
  }

  for (const gl of guestLines) {
    const vid = gl.variantId;
    const q = Math.max(1, Math.floor(gl.quantity));
    byVariant.set(vid, (byVariant.get(vid) ?? 0) + q);
  }

  for (const it of existingItems) {
    const lineId = typeof it.id === "string" ? it.id : "";
    if (!lineId) continue;
    await sdk.store.cart.deleteLineItem(targetCartId, lineId);
  }

  for (const [variantId, quantity] of byVariant) {
    await sdk.store.cart.createLineItem(targetCartId, {
      variant_id: variantId,
      quantity,
    });
  }

  await sdk.store.cart.update(targetCartId, { email });

  const lines = await retrieveCartLines(targetCartId);
  await writeCartCookie(targetCartId);

  return NextResponse.json({ ok: true, cartId: targetCartId, lines: lines ?? [] });
}
