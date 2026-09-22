import { fetchWorkerVariantInventoryForAdmin, adjustWorkerInventoryForAdmin } from "@/lib/worker-admin-bridge";

export { fetchWorkerVariantInventoryForAdmin };

export async function fetchVariantAvailableQuantity(
  variantId: string,
  locationId?: string,
): Promise<number | null> {
  const inventory = await fetchWorkerVariantInventoryForAdmin({ variantId, locationId });
  return inventory?.availableQuantity ?? null;
}

export async function fetchVariantStockedQuantity(
  variantId: string,
  locationId?: string,
): Promise<number | null> {
  const inventory = await fetchWorkerVariantInventoryForAdmin({ variantId, locationId });
  return inventory?.stockedQuantity ?? null;
}

export async function applyVariantStockedQuantity(input: {
  productId: string;
  variantId: string;
  stockedQuantity: number;
  expectedStockedQuantity: number;
  locationId?: string;
  idempotencyKey: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isSafeInteger(input.stockedQuantity) || input.stockedQuantity < 0) {
    return { ok: false, message: "Stock quantity must be a non-negative integer" };
  }
  const response = await adjustWorkerInventoryForAdmin({
    productId: input.productId,
    variantId: input.variantId,
    stockedQuantity: input.stockedQuantity,
    expectedStockedQuantity: input.expectedStockedQuantity,
    locationId: input.locationId,
    reason: input.reason ?? "correction",
    idempotencyKey: input.idempotencyKey,
  });
  if (response?.ok) return { ok: true };
  const detail = await response?.text().catch(() => "");
  return {
    ok: false,
    message: detail?.trim() || (response ? `Inventory update failed (${response.status})` : "Worker inventory API is unavailable"),
  };
}
