export type CatalogVariantStockRow = {
  variantId: string;
  quantity: unknown;
};

export function normalizeStockQuantity(input: unknown): number | undefined {
  if (input === undefined || input === null) return undefined;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

export function validateVariantStocksInput(
  variantStocks: CatalogVariantStockRow[],
  allowedVariantIds: Set<string>,
): string | null {
  const seen = new Set<string>();
  for (const row of variantStocks) {
    const id =
      typeof row.variantId === "string" ? row.variantId.trim() : "";
    if (!id) {
      return "Each variant stock row needs a variant id.";
    }
    if (seen.has(id)) {
      return "Duplicate variant id in variant stock list.";
    }
    seen.add(id);
    if (!allowedVariantIds.has(id)) {
      return "One or more variant stock ids do not belong to this product.";
    }
    const q = normalizeStockQuantity(row.quantity);
    if (q === undefined) {
      return "Use a whole number of zero or more for each variant stock quantity.";
    }
  }
  return null;
}
