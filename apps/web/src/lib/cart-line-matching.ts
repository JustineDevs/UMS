export function findMatchingCartLineIds(items: unknown[], variantId: string): string[] {
  const matchingIds: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const line = item as { id?: unknown; variant_id?: unknown };
    if (line.variant_id === variantId && typeof line.id === "string") {
      matchingIds.push(line.id);
    }
  }
  return matchingIds;
}
