import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";

export type CatalogAdminProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  variantCount: number;
  created_at: string;
  categorySummary: string;
  sizeColorSummary: string;
  shopNotes: string[];
};

// Source-compatible names for the admin pages; all requests are Worker-native.
export function getAdminProductsIndexUrl(): string {
  return "/admin/catalog";
}

export function getAdminProductEditUrl(productId: string): string {
  return `/admin/catalog/${encodeURIComponent(productId)}`;
}

export async function fetchCatalogProductsForAdmin(opts: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
  order?: "-created_at" | "title" | "-title";
}): Promise<{
  products: CatalogAdminProduct[];
  count: number;
  commerceUnavailable?: boolean;
}> {
  const result = await fetchWorkerCatalogProductsForAdmin({
    limit: opts.limit ?? 40,
    offset: opts.offset ?? 0,
    q: opts.q,
    status: opts.status,
    order: opts.order,
  });
  const products = result.products.map((product) => {
    const categorySummary =
      product.categories
        .flatMap((category) => {
          const name = String(category.name ?? "").trim();
          return name ? [name] : [];
        })
        .join(", ") || "—";
    const titles = product.options.map((option) =>
      String(option.title ?? "").toLowerCase(),
    );
    const shopNotes: string[] = [];
    if (product.status === "published") {
      if (categorySummary === "—") shopNotes.push("No category");
      if (
        !titles.some((title) => title.includes("size")) ||
        !titles.some((title) => title.includes("color"))
      ) {
        shopNotes.push("Size/Color options not set (shop filters limited)");
      }
    }
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      thumbnail: product.thumbnail,
      variantCount: product.variantCount,
      created_at: product.created_at,
      categorySummary,
      sizeColorSummary: "—",
      shopNotes,
    };
  });
  return {
    products,
    count: result.count,
    commerceUnavailable: result.commerceUnavailable,
  };
}
