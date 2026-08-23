import { NextResponse } from "next/server";
import { z } from "zod";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import { findMatchingCartLineIds } from "@/lib/cart-line-matching";
import {
  applyRateLimit,
  clearCartCookie,
  parseJsonBody,
  readCartIdFromCookie,
} from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";

const bodySchema = z
  .object({
    variantId: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

async function retrieveMatchingLineIds(cartId: string, variantId: string) {
  const sdk = createStorefrontMedusaSdk();
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields: "id,*items.id,*items.variant_id",
  } as never);
  const items: unknown[] = Array.isArray(cart?.items)
    ? (cart.items as unknown[])
    : [];
  return { sdk, lineIds: findMatchingCartLineIds(items, variantId) };
}

/** Updates a quantity on the cookie-bound Medusa cart without clamping it. */
export async function PUT(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const rateLimit = await applyRateLimit(
    request,
    "cart-line-update",
    60,
    60_000,
  );
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  const body = bodySchema.safeParse(parsed.data);
  if (!body.success || body.data.quantity === undefined) {
    return NextResponse.json(
      { error: "Invalid cart line quantity" },
      { status: 400 },
    );
  }

  const cartId = await readCartIdFromCookie();
  if (!cartId)
    return NextResponse.json({ ok: true, updated: 0, skipped: true });

  try {
    const { sdk, lineIds } = await retrieveMatchingLineIds(
      cartId,
      body.data.variantId,
    );
    if (body.data.quantity === 0) {
      for (const lineId of lineIds)
        await sdk.store.cart.deleteLineItem(cartId, lineId);
      return NextResponse.json({
        ok: true,
        updated: 0,
        removed: lineIds.length,
      });
    }
    const [lineId, ...duplicateIds] = lineIds;
    if (!lineId) return NextResponse.json({ ok: true, updated: 0 });
    await sdk.store.cart.updateLineItem(cartId, lineId, {
      quantity: body.data.quantity,
    });
    for (const duplicateId of duplicateIds)
      await sdk.store.cart.deleteLineItem(cartId, duplicateId);
    return NextResponse.json({
      ok: true,
      updated: 1,
      removed: duplicateIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already completed|completed/i.test(message)) {
      await clearCartCookie();
      return NextResponse.json(
        { error: "Cart expired", code: "CART_COMPLETED", recovered: true },
        { status: 409 },
      );
    }
    console.error("[cart/line] update failed", message);
    return NextResponse.json(
      { error: "Cart line could not be updated" },
      { status: 502 },
    );
  }
}

/** Removes a zero-quantity variant from the cookie-bound Medusa cart. */
export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }
  const rateLimit = await applyRateLimit(
    request,
    "cart-line-delete",
    30,
    60_000,
  );
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  const body = bodySchema.safeParse(parsed.data);
  if (!body.success)
    return NextResponse.json({ error: "Invalid cart line" }, { status: 400 });

  const cartId = await readCartIdFromCookie();
  if (!cartId)
    return NextResponse.json({ ok: true, removed: 0, skipped: true });

  try {
    const { sdk, lineIds } = await retrieveMatchingLineIds(
      cartId,
      body.data.variantId,
    );
    for (const lineId of lineIds) {
      await sdk.store.cart.deleteLineItem(cartId, lineId);
    }
    return NextResponse.json({ ok: true, removed: lineIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already completed|completed/i.test(message)) {
      await clearCartCookie();
      return NextResponse.json(
        { error: "Cart expired", code: "CART_COMPLETED", recovered: true },
        { status: 409 },
      );
    }
    console.error("[cart/line] delete failed", message);
    return NextResponse.json(
      { error: "Cart line could not be removed" },
      { status: 502 },
    );
  }
}
