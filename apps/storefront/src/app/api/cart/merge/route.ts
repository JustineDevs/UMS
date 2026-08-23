import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStorefrontSession } from "@/lib/auth";
import type { CartLine } from "@/lib/cart";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import {
  getMedusaRegionId,
  withSalesChannelId,
} from "@/lib/storefront-medusa-env";
import { extractSessionEmail } from "@universal-music-store/sdk";
import {
  applyRateLimit,
  isValidCartId,
  readCartIdFromCookie,
  writeCartCookie,
  retrieveCartLines,
  retrieveCartRaw,
} from "@/lib/cart-api-helpers";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { cartMergePostBodySchema } from "@universal-music-store/validation";
import { buildCartRestoreOperations } from "@/lib/cart-merge-recovery";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const MAX_CART_MERGE_BODY_BYTES = 64 * 1024;

/**
 * Merges guest session lines into the customer's Medusa cart (combine quantities per variant).
 */
export async function POST(req: Request) {
  const rl = await applyRateLimit(req, "cart-merge", 20, 60_000);
  if (!rl.ok) return rl.response;
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }

  const session = await getStorefrontSession();
  const email = extractSessionEmail(session);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBoundedJson(req, MAX_CART_MERGE_BODY_BYTES);
  if (parsed.tooLarge) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  if (!parsed.valid) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyParsed = cartMergePostBodySchema.safeParse(parsed.value);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: bodyParsed.error.flatten() },
      { status: 400 },
    );
  }

  const guestLines = bodyParsed.data.guestLines ?? [];
  const mergeKey = bodyParsed.data.mergeKey?.trim();
  if (guestLines.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, lines: [] as CartLine[] });
  }
  if (!mergeKey) {
    return NextResponse.json({ error: "mergeKey is required for an idempotent cart merge" }, { status: 400 });
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
    "*items,*items.id,*items.variant_id,*items.quantity,+metadata",
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

  // Claim only after stale-cookie recovery so the lock and completion record use
  // the same final cart ID.
  const mergeStore = createStorefrontServiceSupabase();
  if (!mergeStore) {
    return NextResponse.json(
      { error: "Cart merge is temporarily unavailable", code: "CART_MERGE_LOCK_UNAVAILABLE" },
      { status: 503 },
    );
  }
  const mergeOwner = randomUUID();
  const { data: claim, error: claimError } = await mergeStore.rpc("claim_cart_merge", {
    p_cart_id: targetCartId,
    p_merge_key: mergeKey,
    p_owner_key: mergeOwner,
    p_lock_seconds: 90,
  });
  if (claimError) {
    return NextResponse.json(
      { error: "Cart merge is temporarily unavailable", code: "CART_MERGE_LOCK_FAILED" },
      { status: 503 },
    );
  }
  const claimRow = (Array.isArray(claim) ? claim[0] : claim) as {
    acquired?: boolean;
    replayed?: boolean;
    response?: unknown;
  } | null;
  if (claimRow?.replayed && claimRow.response && typeof claimRow.response === "object") {
    await writeCartCookie(targetCartId);
    return NextResponse.json({ ...(claimRow.response as Record<string, unknown>), replayed: true });
  }
  if (!claimRow?.acquired) {
    return NextResponse.json(
      { error: "A cart merge is already in progress. Try again shortly.", code: "CART_MERGE_IN_PROGRESS" },
      { status: 409, headers: { "Retry-After": "2" } },
    );
  }

  const existingItems = (
    (existing as { items?: Array<{ id?: string; variant_id?: string; quantity?: number }> })
      ?.items ?? []
  );
  const existingMetadata =
    existing && typeof existing === "object" && existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};
  if (mergeKey && existingMetadata.storefront_guest_merge_key === mergeKey) {
    const lines = await retrieveCartLines(targetCartId);
    const response = { ok: true, cartId: targetCartId, replayed: true, lines: lines ?? [] };
    const { data: completed } = await mergeStore.rpc("complete_cart_merge", {
      p_cart_id: targetCartId,
      p_merge_key: mergeKey,
      p_owner_key: mergeOwner,
      p_response: response,
    });
    if (completed !== true) {
      await mergeStore.rpc("release_cart_merge", {
        p_cart_id: targetCartId,
        p_merge_key: mergeKey,
        p_owner_key: mergeOwner,
      });
      return NextResponse.json({ error: "Cart merge could not be durably recorded. Try again." }, { status: 503 });
    }
    await writeCartCookie(targetCartId);
    return NextResponse.json(response);
  }

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

  const existingByVariant = new Map<string, Array<{ id: string; quantity: number }>>();
  for (const item of existingItems) {
    const id = typeof item.id === "string" ? item.id : "";
    const variantId = typeof item.variant_id === "string" ? item.variant_id : "";
    if (!id || !variantId) continue;
    const bucket = existingByVariant.get(variantId) ?? [];
    bucket.push({ id, quantity: Number(item.quantity) || 0 });
    existingByVariant.set(variantId, bucket);
  }

  const originalSnapshot = existingItems.flatMap((item) => {
    const id = typeof item.id === "string" ? item.id : "";
    const variantId = typeof item.variant_id === "string" ? item.variant_id : "";
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? Math.max(0, Math.floor(item.quantity))
      : 0;
    return id && variantId && quantity > 0 ? [{ id, variantId, quantity }] : [];
  });

  try {
    for (const [variantId, quantity] of byVariant) {
      const matches = existingByVariant.get(variantId) ?? [];
      const first = matches.shift();
      if (first) {
        await sdk.store.cart.updateLineItem(targetCartId, first.id, { quantity });
        for (const duplicate of matches) {
          await sdk.store.cart.deleteLineItem(targetCartId, duplicate.id);
        }
      } else {
        await sdk.store.cart.createLineItem(targetCartId, { variant_id: variantId, quantity });
      }
    }

    await sdk.store.cart.update(targetCartId, {
      email,
      ...(mergeKey
        ? { metadata: { ...existingMetadata, storefront_guest_merge_key: mergeKey } }
        : {}),
    });
  } catch {
    const current = await retrieveCartRaw(targetCartId, "*items,*items.id,*items.variant_id,*items.quantity");
    if (current) {
      const currentSnapshot = ((current as { items?: unknown[] }).items ?? []).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as { id?: unknown; variant_id?: unknown; quantity?: unknown };
        const id = typeof row.id === "string" ? row.id : "";
        const variantId = typeof row.variant_id === "string" ? row.variant_id : "";
        const quantity = typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(0, Math.floor(row.quantity))
          : 0;
        return id && variantId && quantity > 0 ? [{ id, variantId, quantity }] : [];
      });
      const operations = buildCartRestoreOperations(originalSnapshot, currentSnapshot);
      try {
        for (const operation of operations) {
          if (operation.type === "update") {
            await sdk.store.cart.updateLineItem(targetCartId, operation.lineId, { quantity: operation.quantity });
          } else if (operation.type === "delete") {
            await sdk.store.cart.deleteLineItem(targetCartId, operation.lineId);
          } else {
            await sdk.store.cart.createLineItem(targetCartId, { variant_id: operation.variantId, quantity: operation.quantity });
          }
        }
      } catch {
        await mergeStore.rpc("release_cart_merge", {
          p_cart_id: targetCartId,
          p_merge_key: mergeKey,
          p_owner_key: mergeOwner,
        });
        return NextResponse.json({ error: "Cart merge failed and needs support recovery." }, { status: 503 });
      }
    }
    await mergeStore.rpc("release_cart_merge", {
      p_cart_id: targetCartId,
      p_merge_key: mergeKey,
      p_owner_key: mergeOwner,
    });
    return NextResponse.json({ error: "Cart merge failed; your cart was restored. Try again." }, { status: 503 });
  }

  const lines = await retrieveCartLines(targetCartId);
  const response = { ok: true, cartId: targetCartId, lines: lines ?? [] };
  const { data: completed } = await mergeStore.rpc("complete_cart_merge", {
    p_cart_id: targetCartId,
    p_merge_key: mergeKey,
    p_owner_key: mergeOwner,
    p_response: response,
  });
  if (completed !== true) {
    await mergeStore.rpc("release_cart_merge", {
      p_cart_id: targetCartId,
      p_merge_key: mergeKey,
      p_owner_key: mergeOwner,
    });
    return NextResponse.json({ error: "Cart merge could not be durably recorded. Try again." }, { status: 503 });
  }
  await writeCartCookie(targetCartId);

  return NextResponse.json(response);
}
