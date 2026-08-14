/**
 * Pure Medusa variant inventory math (no I/O). Used by storefront and POS stock guards.
 * Aligns with Medusa inventory_items.location_levels stocked_quantity / reserved_quantity.
 */

export function stockedQuantityFromVariantRaw(v: Record<string, unknown>): number {
  let stocked = 0;
  const inventoryItems = v.inventory_items as unknown[] | undefined;
  if (!Array.isArray(inventoryItems)) return 0;
  for (const ii of inventoryItems) {
    const item = ii as Record<string, unknown>;
    const inv = item.inventory as Record<string, unknown> | undefined;
    const levels = inv?.location_levels as unknown[] | undefined;
    if (!Array.isArray(levels)) continue;
    for (const lvl of levels) {
      const l = lvl as Record<string, unknown>;
      stocked += Math.max(0, Math.floor(Number(l.stocked_quantity ?? 0)));
    }
  }
  return stocked;
}

export function availableQuantityFromVariantRaw(v: Record<string, unknown>): number {
  let available = 0;
  const inventoryItems = v.inventory_items as unknown[] | undefined;
  if (!Array.isArray(inventoryItems)) return 0;
  for (const ii of inventoryItems) {
    const item = ii as Record<string, unknown>;
    const inv = item.inventory as Record<string, unknown> | undefined;
    const levels = inv?.location_levels as unknown[] | undefined;
    if (!Array.isArray(levels)) continue;
    for (const lvl of levels) {
      const l = lvl as Record<string, unknown>;
      const stocked = Number(l.stocked_quantity ?? 0);
      const reserved = Number(l.reserved_quantity ?? 0);
      available += Math.max(0, stocked - reserved);
    }
  }
  return available;
}
