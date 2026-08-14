/**
 * Weighted random choice for CMS A/B variants (browser or server).
 * Variants must be an array of objects with optional `id` and `weight`.
 */
export function pickCmsAbVariantId(variants: unknown): string {
  if (!Array.isArray(variants) || variants.length === 0) return "a";
  const weights = variants.map((v) => {
    if (v && typeof v === "object" && "weight" in v) {
      const w = Number((v as { weight: unknown }).weight);
      return Number.isFinite(w) && w > 0 ? w : 1;
    }
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < variants.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) {
      const id = (variants[i] as { id?: string })?.id;
      return typeof id === "string" && id ? id : String(i);
    }
  }
  const last = variants[variants.length - 1] as { id?: string };
  return typeof last?.id === "string" ? last.id : "a";
}
