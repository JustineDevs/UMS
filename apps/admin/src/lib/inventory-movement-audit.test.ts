import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordInventoryMovementAudit } from "./inventory-movement-audit";

test("recordInventoryMovementAudit sends quantity_delta as after minus before", async () => {
  let inserted: Record<string, unknown> | null = null;
  const client = {
    from(table: string) {
      assert.equal(table, "staff_catalog_inventory_audit");
      return {
        insert(row: Record<string, unknown>) {
          inserted = row;
          return Promise.resolve({ error: null }) as never;
        },
      };
    },
  } as unknown as SupabaseClient;

  await recordInventoryMovementAudit(client, {
    actorEmail: "staff@example.com",
    reason: "staff_catalog_stock_set",
    referenceType: "catalog_product_update",
    referenceId: "prod_1",
    productId: "prod_1",
    variantId: "var_1",
    inventoryItemId: "iitem_1",
    locationId: "loc_1",
    quantityBefore: 5,
    quantityAfter: 8,
    correlationId: "cid-1",
  });

  assert.ok(inserted);
  assert.strictEqual(inserted.quantity_before, 5);
  assert.strictEqual(inserted.quantity_after, 8);
  assert.strictEqual(inserted.quantity_delta, 3);
  assert.strictEqual(inserted.reference_type, "catalog_product_update");
});
