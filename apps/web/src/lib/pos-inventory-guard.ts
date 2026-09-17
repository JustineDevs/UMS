import { fetchWorkerInventoryPage } from "@/lib/worker-admin-bridge";
import type { AdminApiErrorCode } from "@/lib/staff-api-response";

type PosVariantAvailability =
  | { ok: true; manageInventory: false }
  | { ok: true; manageInventory: true; available: number; label: string }
  | { ok: false; error: string };

/** Reads staff inventory from the Worker and blocks POS sales that exceed available stock. */
async function fetchPosVariantAvailability(
  variantId: string,
): Promise<PosVariantAvailability> {
  const id = variantId.trim();
  if (!id) {
    return { ok: false, error: "Missing variant id" };
  }
  try {
    const result = await fetchWorkerInventoryPage({ limit: 100, offset: 0 });
    const row = result.rows.find((candidate) => candidate.variantId === id);
    if (!row) return { ok: false, error: "Variant not found" };
    const available = Math.floor(row.available);
    const sku = row.sku.trim();
    const label = sku ? `${sku} (${id.slice(0, 8)}…)` : id;
    return { ok: true, manageInventory: true, available, label };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Inventory check failed";
    return { ok: false, error: msg };
  }
}

/**
 * Ensures each variant has enough available quantity before a POS sale.
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
