import assert from "node:assert/strict";
import test from "node:test";

import {
  commitInventoryReservation,
  normalizeReserveInventoryInput,
  releaseInventoryReservation,
  reserveInventory,
} from "./inventory-reservations.js";

test("normalizeReserveInventoryInput enforces tenant location idempotency and positive quantity", () => {
  assert.deepEqual(
    normalizeReserveInventoryInput({
      tenantId: " org_1 ",
      locationId: " loc_1 ",
      inventoryItemId: " item_1 ",
      quantity: 2,
      availableQuantity: 5.8,
      idempotencyKey: " key_1 ",
    }),
    {
      tenant_id: "org_1",
      location_id: "loc_1",
      inventory_item_id: "item_1",
      quantity: 2,
      available_quantity: 5,
      idempotency_key: "key_1",
      reference_type: null,
      reference_id: null,
      metadata: {},
    },
  );
  assert.throws(
    () =>
      normalizeReserveInventoryInput({
        tenantId: "org_1",
        locationId: "loc_1",
        inventoryItemId: "item_1",
        quantity: 0,
        availableQuantity: 5,
        idempotencyKey: "key_1",
      }),
    /quantity must be a positive integer/,
  );
});

test("inventory reservation helpers call the atomic lifecycle rpc", async () => {
  const calls: unknown[] = [];
  const supabase = {
    rpc: async (_name: string, args: unknown) => {
      calls.push(args);
      return {
        data: {
          id: "res_1",
          tenant_id: "org_1",
          location_id: "loc_1",
          inventory_item_id: "item_1",
          quantity: 2,
          status: "active",
          idempotency_key: "key_1",
          metadata: {},
        },
        error: null,
      };
    },
  };

  await reserveInventory(supabase as never, {
    tenantId: "org_1",
    locationId: "loc_1",
    inventoryItemId: "item_1",
    quantity: 2,
    availableQuantity: 5,
    idempotencyKey: "key_1",
  });
  await releaseInventoryReservation(supabase as never, {
    tenantId: "org_1",
    reservationId: "res_1",
    idempotencyKey: "rel_1",
  });
  await commitInventoryReservation(supabase as never, {
    tenantId: "org_1",
    reservationId: "res_1",
    idempotencyKey: "com_1",
  });

  assert.deepEqual(calls.map((call) => (call as { p_operation: string }).p_operation), [
    "reserve",
    "release",
    "commit",
  ]);
});
