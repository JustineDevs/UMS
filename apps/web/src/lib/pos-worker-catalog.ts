type WorkerPrice = {
  calculated_amount?: number | null;
  currency_code?: string | null;
};

export type WorkerPosVariant = {
  id?: string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  calculated_price?: WorkerPrice | null;
};

export type WorkerPosProduct = {
  id?: string;
  title?: string | null;
  thumbnail?: string | null;
  variants?: WorkerPosVariant[] | null;
};

export type PosProduct = {
  variantId: string;
  name: string;
  sku: string;
  barcode?: string;
  size: string;
  color: string;
  price: number;
  imageUrl?: string;
};

type WorkerCatalogResponse = {
  products?: WorkerPosProduct[];
};

function workerUrl(): string | null {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/store/products` : null;
}

function splitVariantTitle(title: string | null | undefined): {
  size: string;
  color: string;
} {
  const values = (title ?? "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length >= 2) return { size: values[0] ?? "", color: values[1] ?? "" };
  return { size: values[0] ?? "", color: "" };
}

export function mapWorkerPosVariant(
  product: WorkerPosProduct,
  variant: WorkerPosVariant,
): PosProduct | null {
  if (!variant.id) return null;
  const { size, color } = splitVariantTitle(variant.title);
  const amount = variant.calculated_price?.calculated_amount;
  const barcode = variant.barcode?.trim() ?? "";
  return {
    variantId: variant.id,
    name: product.title?.trim() ?? "",
    sku: variant.sku?.trim() ?? "",
    ...(barcode ? { barcode } : {}),
    size,
    color,
    price:
      typeof amount === "number" && Number.isFinite(amount)
        ? Math.round(amount) / 100
        : 0,
    ...(product.thumbnail?.trim() ? { imageUrl: product.thumbnail.trim() } : {}),
  };
}

export async function fetchWorkerPosProducts(options: {
  query?: string;
  limit: number;
}): Promise<WorkerPosProduct[]> {
  const endpoint = workerUrl();
  if (!endpoint) throw new Error("POS Worker API is not configured (API_URL)");
  const params = new URLSearchParams({ limit: String(options.limit) });
  if (options.query?.trim()) params.set("q", options.query.trim());
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Worker catalog returned ${response.status}`);
  const payload = await readResponseJson(response, {} as WorkerCatalogResponse);
  return Array.isArray(payload.products) ? payload.products : [];
}

export function flattenWorkerPosProducts(
  products: WorkerPosProduct[],
): PosProduct[] {
  return products.flatMap((product) =>
    (product.variants ?? [])
      .map((variant) => mapWorkerPosVariant(product, variant))
      .filter((item): item is PosProduct => item !== null),
  );
}

export function findWorkerPosProduct(
  products: WorkerPosProduct[],
  identifier: string,
): PosProduct | null {
  const normalized = identifier.trim();
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (variant.sku?.trim() === normalized || variant.barcode?.trim() === normalized) {
        return mapWorkerPosVariant(product, variant);
      }
    }
  }
  return null;
}
import { readResponseJson } from "./read-response-json";
