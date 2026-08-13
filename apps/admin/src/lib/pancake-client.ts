const DEFAULT_PANCAKE_API_BASE = "https://pos.pages.fm/api/v1";

export type PancakeShop = {
  id: number;
  name: string;
  avatarUrl: string | null;
  pages: Array<{
    id: string;
    name: string;
    platform: string | null;
    autoCreateOrder: boolean | null;
  }>;
};

export type PancakeResource =
  | "orders"
  | "customers"
  | "products"
  | "warehouses"
  | "inventory_histories"
  | "order_source"
  | "order_tags"
  | "e_invoices"
  | "employees"
  | "analytics_sale";

export class PancakeApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
    this.name = "PancakeApiError";
  }
}

function getApiKey(): string | null {
  return process.env.PANCAKE_POS_API_KEY?.trim() || process.env.PANCAKE_API_KEY?.trim() || null;
}

function getBaseUrl(): string {
  return (process.env.PANCAKE_POS_API_URL?.trim() || DEFAULT_PANCAKE_API_BASE).replace(/\/$/, "");
}

export function isPancakeConfigured(): boolean {
  return Boolean(getApiKey());
}

function toShop(value: unknown): PancakeShop | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  const pages = Array.isArray(row.pages)
    ? row.pages.flatMap((page) => {
        if (!page || typeof page !== "object") return [];
        const item = page as Record<string, unknown>;
        return [{
          id: String(item.id ?? ""),
          name: String(item.name ?? "Unnamed page"),
          platform: typeof item.platform === "string" ? item.platform : null,
          autoCreateOrder:
            typeof (item.settings as Record<string, unknown> | undefined)?.auto_create_order === "boolean"
              ? ((item.settings as Record<string, unknown>).auto_create_order as boolean)
              : null,
        }];
      })
    : [];
  return {
    id,
    name: String(row.name ?? `Shop ${id}`),
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    pages,
  };
}

export async function pancakeRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new PancakeApiError("Pancake API key is not configured", 503);
  const url = new URL(`${getBaseUrl()}${path}`);
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = body && typeof body === "object" && "message" in body
      ? String((body as { message?: unknown }).message)
      : `Pancake API returned HTTP ${response.status}`;
    throw new PancakeApiError(detail, response.status);
  }
  return body as T;
}

export async function listPancakeShops(): Promise<PancakeShop[]> {
  const body = await pancakeRequest<{ shops?: unknown[] }>("/shops");
  return Array.isArray(body?.shops) ? body.shops.flatMap((shop) => {
    const normalized = toShop(shop);
    return normalized ? [normalized] : [];
  }) : [];
}

const RESOURCE_PATHS: Record<PancakeResource, (..._args: [string]) => string> = {
  orders: (id) => `/shops/${encodeURIComponent(id)}/orders`,
  customers: (id) => `/shops/${encodeURIComponent(id)}/customers`,
  products: (id) => `/shops/${encodeURIComponent(id)}/products/variations`,
  warehouses: (id) => `/shops/${encodeURIComponent(id)}/warehouses`,
  inventory_histories: (id) => `/shops/${encodeURIComponent(id)}/inventory_histories`,
  order_source: (id) => `/shops/${encodeURIComponent(id)}/order_source`,
  order_tags: (id) => `/shops/${encodeURIComponent(id)}/orders/tags`,
  e_invoices: (id) => `/shops/${encodeURIComponent(id)}/list_einvoices/`,
  employees: (id) => `/shops/${encodeURIComponent(id)}/users`,
  analytics_sale: (id) => `/shops/${encodeURIComponent(id)}/analytics/sale`,
};

export async function listPancakeResource(
  resource: PancakeResource,
  shopId: string,
  query: URLSearchParams,
): Promise<unknown> {
  const path = RESOURCE_PATHS[resource](shopId);
  const upstreamQuery = new URLSearchParams(query);
  upstreamQuery.delete("resource");
  upstreamQuery.delete("shopId");
  const suffix = upstreamQuery.toString();
  return pancakeRequest(`${path}${suffix ? `?${suffix}` : ""}`);
}
