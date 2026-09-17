/**
 * Pure sales-channel merge logic extracted from catalog-product-mutations.
 * No SDK or HTTP dependencies so this is safe to unit-test in isolation.
 */

export function mergeSalesChannelsForProductUpdate(
  existing: Array<{ id?: string | null }> | undefined,
  envChannelId: string | undefined,
): Array<{ id: string }> | undefined {
  const env = envChannelId?.trim();
  if (!env) return undefined;
  const set = new Set<string>();
  for (const ch of existing ?? []) {
    const id = ch?.id;
    if (typeof id === "string" && id.trim()) set.add(id.trim());
  }
  set.add(env);
  return [...set].map((id) => ({ id }));
}
