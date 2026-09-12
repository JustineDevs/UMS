import { availableQuantityFromVariantRaw } from "@universal-music-store/validation";
import { fetchMedusaAdminVariant } from "@/lib/medusa-admin-variant";
import type { MedusaCheckoutLine } from "@/lib/medusa-checkout-cart-prep";

export type StorefrontStockResult =
  | { ok: true }
  | { ok: false; message: string; code: "INSUFFICIENT_STOCK" | "INVENTORY_CHECK_FAILED" };

export function inventoryLookupFailure(status: number): StorefrontStockResult {
  return {
    ok: false,
    message:
      status === 404
        ? "A bag item is no longer available in the catalog. Remove it and add it again from the product page."
        : `Variant lookup failed (${status})`,
    code: "INVENTORY_CHECK_FAILED",
  };
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
    try {
      const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
      if (workerBaseUrl) {
        const response = await fetch(
          `${workerBaseUrl}/store/inventory/${encodeURIComponent(variantId)}`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        );
        if (!response.ok) return inventoryLookupFailure(response.status);
        const payload = (await response.json()) as {
          availability?: { manageInventory?: unknown; availableQuantity?: unknown };
        };
        const availability = payload.availability;
        if (!availability) return inventoryLookupFailure(502);
        if (availability.manageInventory === false) continue;
        const available = Math.floor(Number(availability.availableQuantity));
        if (!Number.isFinite(available)) return inventoryLookupFailure(502);
        if (available < need) {
          return {
            ok: false,
            message: `Insufficient stock for ${variantId}: need ${need}, available ${available}`,
            code: "INSUFFICIENT_STOCK",
          };
        }
        continue;
      }
      const v = await fetchMedusaAdminVariant(variantId);
      if (!v) return inventoryLookupFailure(404);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Inventory check failed";
      return { ok: false, message: msg, code: "INVENTORY_CHECK_FAILED" };
    }
  }

  return { ok: true };
}
