import { getMedusaStoreBaseUrl } from "@universal-music-store/sdk";
import { optionRowsToSizeColor } from "@/lib/medusa-pos";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";

export type MedusaProductListRow = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  variantCount: number;
  created_at: string;
  /** Category names from Medusa (shop filters). */
  categorySummary: string;
  /** Size / Color from first variant when present. */
  sizeColorSummary: string;
  /** Non-blocking hints when published products lack shop data. */
  shopNotes: string[];
};

/** Medusa Dashboard (product editor, collections, etc.). Same host as the commerce API. */
export function getMedusaAdminAppBaseUrl(): string {
  return `${getMedusaStoreBaseUrl().replace(/\/$/, "")}/app`;
}

export function getMedusaAdminProductsIndexUrl(): string {
  return `${getMedusaAdminAppBaseUrl()}/products`;
}

export function getMedusaAdminProductEditUrl(productId: string): string {
  return `${getMedusaAdminAppBaseUrl()}/products/${encodeURIComponent(productId)}`;
}

/** Medusa Dashboard draft order editor (finish payment and shipping in store admin). */
export function getMedusaAdminDraftOrderEditUrl(draftOrderId: string): string {
  return `${getMedusaAdminAppBaseUrl()}/draft-orders/${encodeURIComponent(draftOrderId)}`;
}

export async function fetchMedusaProductsListForAdmin(opts: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
  order?: "-created_at" | "title" | "-title";
}): Promise<{
  products: MedusaProductListRow[];
  count: number;
  commerceUnavailable?: boolean;
}> {
  const limit = opts.limit ?? 40;
  const offset = opts.offset ?? 0;
  const q = opts.q?.trim() ?? "";
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  qs.set(
    "fields",
    "id,title,handle,status,thumbnail,created_at,*variants,*variants.options,*variants.options.option,*categories",
  );
  if (q) qs.set("q", q);
  if (opts.status && ["draft", "published", "rejected"].includes(opts.status)) {
    qs.set("status", opts.status);
  }
  if (opts.order) qs.set("order", opts.order);

  let res: Response;
  try {
    res = await medusaAdminFetch(`/admin/products?${qs.toString()}`, {
      method: "GET",
    });
  } catch {
    return { products: [], count: 0, commerceUnavailable: true };
  }
  if (!res.ok) {
    return { products: [], count: 0 };
  }
  const json = (await res.json()) as {
    products?: unknown[];
    count?: number;
  };
  const raw = Array.isArray(json.products) ? json.products : [];
  const products: MedusaProductListRow[] = raw.map((p) => {
    const o = p as Record<string, unknown>;
    const variants = o.variants;
    const variantCount = Array.isArray(variants) ? variants.length : 0;
    const firstVariant =
      Array.isArray(variants) && variants[0]
        ? (variants[0] as Record<string, unknown>)
        : null;
    const optRows = (firstVariant?.options ?? []) as Parameters<
      typeof optionRowsToSizeColor
    >[0];
    const { size, color } = optionRowsToSizeColor(optRows);
    const sizeColorSummary = [size, color].filter(Boolean).join(" / ") || "—";

    const cats = (o.categories ?? []) as Array<{ name?: string }>;
    const categorySummary =
      cats
        .map((c) => String(c.name ?? "").trim())
        .filter(Boolean)
        .join(", ") || "—";

    const status = String(o.status ?? "");
    const shopNotes: string[] = [];
    if (status === "published") {
      if (categorySummary === "—") {
        shopNotes.push("No category");
      }
      const productOptions = (o as { options?: Array<{ title?: string }> })
        .options;
      const titles = (productOptions ?? []).map((x) =>
        String(x.title ?? "").toLowerCase(),
      );
      const hasSizeColor =
        titles.some((t) => t.includes("size")) &&
        titles.some((t) => t.includes("color"));
      if (!hasSizeColor) {
        shopNotes.push("Size/Color options not set (shop filters limited)");
      }
    }

    return {
      id: String(o.id ?? ""),
      title: String(o.title ?? ""),
      handle: String(o.handle ?? ""),
      status,
      thumbnail: typeof o.thumbnail === "string" ? o.thumbnail : null,
      variantCount,
      created_at:
        typeof o.created_at === "string"
          ? o.created_at
          : new Date().toISOString(),
      categorySummary,
      sizeColorSummary,
      shopNotes,
    };
  });
  return {
    products,
    count: typeof json.count === "number" ? json.count : products.length,
  };
}
