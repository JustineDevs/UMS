import type { WorkerDatabaseClient } from "./database.ts";

type InventoryRow = {
  variant_id: string;
  manage_inventory: boolean | null;
  stocked_quantity: string | number;
  reserved_quantity: string | number;
  incoming_quantity: string | number;
};

export type InventoryAvailability = {
  variantId: string;
  manageInventory: boolean;
  stockedQuantity: number;
  reservedQuantity: number;
  incomingQuantity: number;
  availableQuantity: number;
};

export async function getVariantAvailability(
  variantId: string,
  database: WorkerDatabaseClient,
): Promise<InventoryAvailability | null> {
  const normalized = variantId.trim();
  if (!normalized || normalized.length > 255) return null;
  const result = await database.query<InventoryRow>(
    `SELECT v.id AS variant_id, v.manage_inventory,
            COALESCE(SUM(il.stocked_quantity), 0) AS stocked_quantity,
            COALESCE(SUM(il.reserved_quantity), 0) AS reserved_quantity,
            COALESCE(SUM(il.incoming_quantity), 0) AS incoming_quantity
     FROM public.product_variant_inventory_item pvi
     JOIN public.product_variant v ON v.id = pvi.variant_id AND v.deleted_at IS NULL
     JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
     WHERE pvi.variant_id = $1 AND pvi.deleted_at IS NULL
     GROUP BY v.id`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row) return null;
  const stockedQuantity = Math.max(0, Number(row.stocked_quantity));
  const reservedQuantity = Math.max(0, Number(row.reserved_quantity));
  const incomingQuantity = Math.max(0, Number(row.incoming_quantity));
  return {
    variantId: row.variant_id,
    manageInventory: row.manage_inventory !== false,
    stockedQuantity,
    reservedQuantity,
    incomingQuantity,
    availableQuantity: Math.max(0, stockedQuantity - reservedQuantity),
  };
}

export async function handleInventoryAvailabilityRequest(
  request: Request,
  database: WorkerDatabaseClient,
  variantId: string,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  const availability = await getVariantAvailability(variantId, database);
  if (!availability)
    return new Response(
      JSON.stringify({ type: "not_found", message: "Variant not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  return new Response(JSON.stringify({ availability }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
