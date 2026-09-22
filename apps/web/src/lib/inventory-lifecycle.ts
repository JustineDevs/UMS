import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { applyVariantStockedQuantity, fetchVariantStockedQuantity } from "@/lib/worker-catalog-inventory-stock";
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
  idempotencyKey: string;
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
  for (const [index, change] of prepared.entries()) {
    const keyFor = (phase: "apply" | "compensate", item: InventoryStockChange) =>
      createHash("sha256")
        .update(`${input.idempotencyKey}:${phase}:${index}:${item.variantId}:${item.locationId}:${item.quantityAfter}`)
        .digest("hex");
    const result = await applyVariantStockedQuantity({
      productId: change.productId,
      variantId: change.variantId,
      stockedQuantity: change.quantityAfter,
      expectedStockedQuantity: change.quantityBefore,
      locationId: change.locationId,
      idempotencyKey: keyFor("apply", change),
      reason: input.referenceType.slice(0, 32),
    });
    if (!result.ok) {
      for (const [rollbackIndex, previous] of applied.reverse().entries()) {
        await applyVariantStockedQuantity({
          productId: previous.productId,
          variantId: previous.variantId,
          stockedQuantity: previous.quantityBefore,
          expectedStockedQuantity: previous.quantityAfter,
          locationId: previous.locationId,
          idempotencyKey: createHash("sha256")
            .update(`${input.idempotencyKey}:compensate:${rollbackIndex}:${previous.variantId}:${previous.locationId}:${previous.quantityBefore}`)
            .digest("hex"),
          reason: `${input.referenceType}:rollback`.slice(0, 32),
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
