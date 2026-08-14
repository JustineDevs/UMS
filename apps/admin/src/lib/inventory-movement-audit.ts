import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "@universal-music-store/platform-data";

export type InventoryMovementInsert = {
  actorEmail: string | null;
  reason: string;
  referenceType: string;
  referenceId: string;
  productId: string;
  variantId: string;
  inventoryItemId: string | null;
  locationId: string;
  quantityBefore: number | null;
  quantityAfter: number;
  correlationId: string;
  organizationId?: string | null;
};

export async function recordInventoryMovementAudit(
  client: SupabaseClient,
  row: InventoryMovementInsert,
): Promise<void> {
  const quantityDelta = row.quantityAfter - (row.quantityBefore ?? 0);
  const { error } = await client.from("staff_catalog_inventory_audit").insert({
    actor_email: row.actorEmail,
    reason: row.reason,
    reference_type: row.referenceType,
    reference_id: row.referenceId,
    product_id: row.productId,
    variant_id: row.variantId,
    inventory_item_id: row.inventoryItemId,
    location_id: row.locationId,
    quantity_before: row.quantityBefore,
    quantity_after: row.quantityAfter,
    quantity_delta: quantityDelta,
    correlation_id: row.correlationId,
    organization_id: row.organizationId ?? null,
    metadata: {},
  });
  if (error && isMissingTableOrSchemaError(error)) {
    return;
  }
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "inventory_movement_insert_failed",
        code: error.code,
        message: error.message?.slice(0, 300),
      }),
    );
  }
}
