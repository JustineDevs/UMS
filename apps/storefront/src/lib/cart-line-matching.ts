export function findMatchingCartLineIds(items: unknown[], variantId: string): string[] {
  return items
    .filter((item): item is { id?: unknown; variant_id?: unknown } => Boolean(item && typeof item === "object"))
    .filter((item) => item.variant_id === variantId && typeof item.id === "string")
    .map((item) => item.id as string);
}
