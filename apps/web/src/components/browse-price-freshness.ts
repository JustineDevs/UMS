export function buildFreshnessSignature(
  variants: Array<{
    id?: string;
    inventoryQuantity?: number | null;
    manageInventory?: boolean;
    isActive?: boolean;
  }>,
): string {
  return variants
    .map((variant) =>
      [
        variant.id ?? "",
        variant.manageInventory === false ? "unmanaged" : String(variant.inventoryQuantity ?? "unknown"),
        variant.isActive === false ? "inactive" : "active",
      ].join(":"),
    )
    .sort()
    .join("|");
}
