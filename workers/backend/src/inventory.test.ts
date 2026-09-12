import assert from "node:assert/strict";
import test from "node:test";
import {
  getVariantAvailability,
  handleInventoryAvailabilityRequest,
} from "./inventory.ts";

test("computes non-negative sellable availability from stocked minus reserved quantities", async () => {
  const availability = await getVariantAvailability("var-1", {
    async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
      return {
        rowCount: 1,
        rows: [
          {
            variant_id: "var-1",
            manage_inventory: true,
            stocked_quantity: "12",
            reserved_quantity: "5",
            incoming_quantity: "4",
          },
        ] as Row[],
      };
    },
    async end(): Promise<void> {},
  });
  assert.deepEqual(availability, {
    variantId: "var-1",
    manageInventory: true,
    stockedQuantity: 12,
    reservedQuantity: 5,
    incomingQuantity: 4,
    availableQuantity: 7,
  });
});

test("returns zero availability when reservations exceed stock", async () => {
  const availability = await getVariantAvailability("var-2", {
    async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
      return {
        rowCount: 1,
        rows: [
          {
            variant_id: "var-2",
            manage_inventory: true,
            stocked_quantity: 2,
            reserved_quantity: 8,
            incoming_quantity: 0,
          },
        ] as Row[],
      };
    },
    async end(): Promise<void> {},
  });
  assert.equal(availability?.availableQuantity, 0);
});

test("returns a safe not-found response for invalid inventory", async () => {
  const response = await handleInventoryAvailabilityRequest(
    new Request("https://api.test/store/inventory/unknown"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return { rows: [], rowCount: 0 };
      },
      async end(): Promise<void> {},
    },
    "unknown",
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    type: "not_found",
    message: "Variant not found",
  });
});
