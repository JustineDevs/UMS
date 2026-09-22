import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";

export type ChatOrderVariantLine = {
  variantId: string;
  label: string;
  productTitle: string;
  sku: string | null;
};

export type ChatOrderVariantSearchResult =
  | { lines: ChatOrderVariantLine[] }
  | { unavailable: true };

type CatalogProductsFetcher = typeof fetchWorkerCatalogProductsForAdmin;

/** Search sellable variants for chat-order intake through the staff Worker catalog contract. */
export async function searchCatalogVariantLines(
  q: string,
  limitProducts = 12,
  fetchProducts: CatalogProductsFetcher = fetchWorkerCatalogProductsForAdmin,
): Promise<ChatOrderVariantSearchResult> {
  const qt = q.trim();
  if (qt.length < 2) return { lines: [] };
  const result = await fetchProducts({ limit: limitProducts, offset: 0, q: qt, status: "published" });
  if (result.commerceUnavailable) return { unavailable: true };
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
  return { lines: out.slice(0, 40) };
}
