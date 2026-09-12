import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { availableQuantityFromVariantRaw } from "@/lib/inventory-quantity-utils";
import type { AdminApiErrorCode } from "@/lib/staff-api-response";

const VARIANT_FIELDS =
  "id,sku,manage_inventory,*inventory_items,*inventory_items.inventory,*inventory_items.inventory.location_levels";

export type PosVariantAvailability =
  | { ok: true; manageInventory: false }
  | { ok: true; manageInventory: true; available: number; label: string }
  | { ok: false; error: string };

/** Reads Medusa variant inventory. When manage_inventory is false, POS does not block on quantity. */
export async function fetchPosVariantAvailability(
  variantId: string,
): Promise<PosVariantAvailability> {
  const id = variantId.trim();
  if (!id) {
    return { ok: false, error: "Missing variant id" };
  }
  try {
    const params = new URLSearchParams({
      id,
      limit: "1",
      fields: VARIANT_FIELDS,
    });
    const res = await medusaAdminFetch(`/admin/product-variants?${params}`, {
      method: "GET",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Variant lookup failed (${res.status})`,
      };
    }
    const json = (await res.json()) as { variants?: unknown[] };
    const rawVariant = json.variants?.[0];
    if (!rawVariant || typeof rawVariant !== "object") {
      return { ok: false, error: "Variant not found" };
    }
    const v = rawVariant as Record<string, unknown>;
    const manage = Boolean(v.manage_inventory);
    if (!manage) {
      return { ok: true, manageInventory: false };
    }
    const available = Math.floor(availableQuantityFromVariantRaw(v));
    const sku = String(v.sku ?? "").trim();
    const label = sku ? `${sku} (${id.slice(0, 8)}…)` : id;
    return { ok: true, manageInventory: true, available, label };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Inventory check failed";
    return { ok: false, error: msg };
  }
}

/**
 * Ensures each variant has enough available quantity when Medusa tracks inventory.
 */
export async function assertPosCartStock(
  items: Array<{ variantId: string; quantity: number }>,
): Promise<
  | { ok: true }
  | { ok: false; message: string; code: AdminApiErrorCode }
> {
  const qtyByVariant = new Map<string, number>();
  for (const i of items) {
    const vid = String(i.variantId ?? "").trim();
    if (!vid) continue;
    const q = Math.max(1, Math.floor(Number(i.quantity) || 1));
    qtyByVariant.set(vid, (qtyByVariant.get(vid) ?? 0) + q);
  }

  for (const [variantId, need] of qtyByVariant) {
    const av = await fetchPosVariantAvailability(variantId);
    if (!av.ok) {
      return {
        ok: false,
        message: av.error,
        code: "INVENTORY_CHECK_FAILED",
      };
    }
    if (!av.manageInventory) continue;
    if (av.available < need) {
      return {
        ok: false,
        message: `Insufficient stock for ${av.label}: need ${need}, available ${av.available}`,
        code: "INSUFFICIENT_STOCK",
      };
    }
  }

  return { ok: true };
}
