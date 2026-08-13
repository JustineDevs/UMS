import type { SupabaseClient } from "@supabase/supabase-js";
import { applyVariantStockedQuantity, fetchVariantStockedQuantity } from "@/lib/medusa-catalog-inventory-stock";
import { recordInventoryMovementAudit } from "@/lib/inventory-movement-audit";

export type InventoryStockChange = {
  productId: string;
  variantId: string;
  locationId: string;
  quantityBefore: number;
  quantityAfter: number;
};

export async function applyInventoryStockChanges(input: {
  changes: InventoryStockChange[];
  client: SupabaseClient;
  actorEmail: string;
  correlationId: string;
  referenceType: string;
  referenceId: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const prepared: InventoryStockChange[] = [];
  for (const change of input.changes) {
    const current = await fetchVariantStockedQuantity(change.variantId, change.locationId);
    if (current == null) {
      return { ok: false, code: "INVENTORY_READ_FAILED", message: "Inventory quantity is unavailable" };
    }
    if (current !== change.quantityBefore) {
      return { ok: false, code: "INVENTORY_CONFLICT", message: "Inventory changed; refresh and retry" };
    }
    if (change.quantityAfter < 0) {
      return { ok: false, code: "INSUFFICIENT_INVENTORY", message: "Insufficient inventory at the source location" };
    }
    prepared.push({ ...change, quantityBefore: current });
  }

  const applied: InventoryStockChange[] = [];
  for (const change of prepared) {
    const result = await applyVariantStockedQuantity({
      productId: change.productId,
      variantId: change.variantId,
      stockedQuantity: change.quantityAfter,
      locationId: change.locationId,
    });
    if (!result.ok) {
      for (const previous of applied.reverse()) {
        await applyVariantStockedQuantity({
          productId: previous.productId,
          variantId: previous.variantId,
          stockedQuantity: previous.quantityBefore,
          locationId: previous.locationId,
        });
      }
      return { ok: false, code: "INVENTORY_WRITE_FAILED", message: "Unable to apply inventory changes" };
    }
    applied.push(change);
    await recordInventoryMovementAudit(input.client, {
      actorEmail: input.actorEmail,
      reason: input.referenceType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      productId: change.productId,
      variantId: change.variantId,
      inventoryItemId: null,
      locationId: change.locationId,
      quantityBefore: change.quantityBefore,
      quantityAfter: change.quantityAfter,
      correlationId: input.correlationId,
    });
  }
  return { ok: true };
}
