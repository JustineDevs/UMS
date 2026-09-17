const PLACEHOLDER_VALUES = new Set(["n/a", "na", "none", "null", "unknown", "-", "—"]);

export function normalizeCatalogFacetValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > 80 || PLACEHOLDER_VALUES.has(normalized.toLowerCase())) return null;
  return normalized;
}
