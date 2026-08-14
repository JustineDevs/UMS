import { availableQuantityFromVariantRaw } from "@universal-music-store/validation";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import type { MedusaCheckoutLine } from "@/lib/medusa-checkout-cart-prep";
import { tryDeleteStoreCart } from "@/lib/medusa-checkout-errors";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
  getMedusaStoreBaseUrl,
  withSalesChannelId,
} from "./storefront-medusa-env";

const VARIANT_FIELDS =
  "id,sku,manage_inventory,*inventory_items,*inventory_items.inventory,*inventory_items.inventory.location_levels";

export type StorefrontStockResult =
  | { ok: true }
  | { ok: false; message: string; code: "INSUFFICIENT_STOCK" | "INVENTORY_CHECK_FAILED" };

/**
 * When Admin GET /admin/product-variants/:id returns 404, the variant may still be
 * sellable via the Store API (admin route shape, key scope, or stale Admin index).
 * Probing with a throwaway cart matches what checkout will do.
 */
async function variantSellableViaStoreCart(
  variantId: string,
  need: number,
): Promise<boolean> {
  const regionId = getMedusaRegionId();
  const publishableKey = getMedusaPublishableKey();
  const baseUrl = getMedusaStoreBaseUrl();
  if (!regionId || !publishableKey) return false;

  const sdk = createStorefrontMedusaSdk();
  let cartId: string | undefined;
  const qty = Math.min(Math.max(Math.floor(need), 1), 500);
  try {
    const { cart: created } = await sdk.store.cart.create(
      withSalesChannelId({ region_id: regionId }) as Parameters<
        typeof sdk.store.cart.create
      >[0],
    );
    cartId = created?.id;
    if (!cartId) return false;
    await sdk.store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity: qty,
    });
    return true;
  } catch {
    return false;
  } finally {
    if (cartId) {
      await tryDeleteStoreCart(cartId, baseUrl, publishableKey);
    }
  }
}

/**
 * Server-side stock check against Medusa Admin API (same source as POS). Runs before cart creation.
 */
export async function assertStorefrontLinesStock(
  lines: MedusaCheckoutLine[],
): Promise<StorefrontStockResult> {
  const qtyByVariant = new Map<string, number>();
  for (const l of lines) {
    const vid = String(l.variantId ?? "").trim();
    if (!vid) continue;
    const q = Math.max(1, Math.floor(Number(l.quantity) || 1));
    qtyByVariant.set(vid, (qtyByVariant.get(vid) ?? 0) + q);
  }

  for (const [variantId, need] of qtyByVariant) {
    let res: Response;
    try {
      res = await medusaAdminFetch(
        `/admin/product-variants/${encodeURIComponent(variantId)}?fields=${encodeURIComponent(VARIANT_FIELDS)}`,
        { method: "GET" },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Inventory check failed";
      return { ok: false, message: msg, code: "INVENTORY_CHECK_FAILED" };
    }
    if (!res.ok) {
      if (res.status === 404) {
        const okStore = await variantSellableViaStoreCart(variantId, need);
        if (okStore) {
          continue;
        }
      }
      return {
        ok: false,
        message:
          res.status === 404
            ? "This bag line points to a variant that is not in the catalog (or no longer exists). Remove the item and add it again from the product page."
            : `Variant lookup failed (${res.status})`,
        code: "INVENTORY_CHECK_FAILED",
      };
    }
    const json = (await res.json()) as { variant?: Record<string, unknown> };
    const v = json.variant;
    if (!v || typeof v !== "object") {
      return {
        ok: false,
        message: "Variant not found",
        code: "INVENTORY_CHECK_FAILED",
      };
    }
    const manage = Boolean(v.manage_inventory);
    if (!manage) continue;
    const available = Math.floor(availableQuantityFromVariantRaw(v));
    if (available < need) {
      const sku = String(v.sku ?? "").trim();
      const label = sku ? `${sku} (${variantId.slice(0, 8)}…)` : variantId;
      return {
        ok: false,
        message: `Insufficient stock for ${label}: need ${need}, available ${available}`,
        code: "INSUFFICIENT_STOCK",
      };
    }
  }

  return { ok: true };
}
