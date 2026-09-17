import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";

export type ChatOrderVariantLine = {
  variantId: string;
  label: string;
  productTitle: string;
  sku: string | null;
};

/** Search sellable variants for chat-order intake through the staff Worker catalog contract. */
export async function searchCatalogVariantLines(
  q: string,
  limitProducts = 12,
): Promise<ChatOrderVariantLine[]> {
  const qt = q.trim();
  if (qt.length < 2) return [];
  const result = await fetchWorkerCatalogProductsForAdmin({ limit: limitProducts, offset: 0, q: qt, status: "published" });
  if (result.commerceUnavailable) return [];
  const out: ChatOrderVariantLine[] = [];
  for (const product of result.products) {
    const productTitle = product.title.trim() || "Untitled";
    for (const variant of product.variants) {
      const id = variant.id != null ? String(variant.id) : "";
      if (!id) continue;
      const sku = typeof variant.sku === "string" && variant.sku.trim() ? variant.sku.trim() : null;
      out.push({
        variantId: id,
        label: `${productTitle} — ${sku || "Option"}`,
        productTitle,
        sku,
      });
    }
  }
  return out.slice(0, 40);
}
