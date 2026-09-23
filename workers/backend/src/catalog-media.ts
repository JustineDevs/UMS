const DECOMMISSIONED_CATALOG_MEDIA_HOSTS = new Set([
  "gvsyfyaqxfrunoghgqiq.supabase.co",
]);

/**
 * Catalog media is user-visible data and must not leak URLs for a retired
 * storage project through cart, checkout, order, or catalog responses.
 */
export function normalizeCatalogMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    if (DECOMMISSIONED_CATALOG_MEDIA_HOSTS.has(hostname)) return null;
  } catch {
    // Preserve relative media paths; normal media validation handles malformed
    // absolute URLs at the owning API boundary.
  }
  return normalized;
}
