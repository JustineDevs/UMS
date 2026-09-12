import assert from "node:assert/strict";
import test from "node:test";

import {
  commitInventoryReservation,
  expireDueInventoryReservations,
  expireInventoryReservation,
  normalizeReserveInventoryInput,
  releaseInventoryReservation,
  reserveInventory,
  setInventoryReservationExpiry,
  deriveInventoryQuantitySemantics,
} from "./inventory-reservations.js";

test("inventory semantics keep stocked, reserved, available, and sellable distinct", () => {
  assert.deepEqual(deriveInventoryQuantitySemantics({ stocked: 10, reserved: 3 }), { stocked: 10, reserved: 3, available: 7, sellable: 7 });
  assert.deepEqual(deriveInventoryQuantitySemantics({ stocked: 2, reserved: 9 }), { stocked: 2, reserved: 2, available: 0, sellable: 0 });
});

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

test("inventory expiry helpers validate timestamps and call tenant-scoped RPCs", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "inventory_reservation_expire_due") return { data: 2, error: null };
      return {
        data: {
          id: "res_1", tenant_id: "org_1", status: "released", metadata: {},
          quantity: 1, location_id: "loc", inventory_item_id: "item",
        },
        error: null,
      };
    },
  };
  await setInventoryReservationExpiry(supabase as never, {
    tenantId: "org_1", reservationId: "res_1", expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await expireInventoryReservation(supabase as never, {
    tenantId: "org_1", reservationId: "res_1", idempotencyKey: "expire_1",
  });
  assert.equal(await expireDueInventoryReservations(supabase as never, { tenantId: "org_1" }), 2);
  assert.deepEqual(calls.map((call) => call.name), [
    "inventory_reservation_set_expiry",
    "inventory_reservation_expire",
    "inventory_reservation_expire_due",
  ]);
  await assert.rejects(
    setInventoryReservationExpiry(supabase as never, {
      tenantId: "org_1", reservationId: "res_1", expiresAt: new Date(Date.now() - 1).toISOString(),
    }),
    /future timestamp/,
  );
});
