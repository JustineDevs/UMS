export function canonicalProductIdFromAdminVariant(
  variant: Record<string, unknown> | null,
): string | null {
  const productId = variant?.product_id;
  return typeof productId === "string" && productId.trim() ? productId.trim() : null;
}
