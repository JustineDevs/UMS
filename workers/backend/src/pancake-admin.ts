import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { POS_FEATURE_MAPPINGS } from "../../../packages/platform-data/src/pos-feature-mappings.ts";

type Env = {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  PANCAKE_POS_API_KEY?: string;
  PANCAKE_POS_API_URL?: string;
  fetch?: typeof fetch;
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

const RESOURCES = new Set<PancakeResource>([
  "orders", "customers", "products", "warehouses", "inventory_histories",
  "order_source", "order_tags", "e_invoices", "employees", "analytics_sale",
]);
const RESOURCE_PATHS: Record<PancakeResource, (_shopId: string) => string> = {
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
const BASE_URL = "https://pos.pages.fm/api/v1";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function canRead(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((permission) => permission === "*" || permission === "settings:read");
}

function validBase(value: string | undefined): URL | null {
  try {
    const url = new URL(value?.trim() || BASE_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return new URL(url.toString().replace(/\/$/, ""));
  } catch {
    return null;
  }
}

function boundedQuery(source: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams();
  const allowed = new Set(["limit", "page_size", "offset", "page", "search", "keyword", "status", "from", "to", "start_date", "end_date", "sort"]);
  for (const [key, value] of source) {
    if (!allowed.has(key) || value.length > 200) continue;
    if (key === "limit" || key === "page_size") {
      const number = Number(value);
      if (Number.isFinite(number)) result.set(key, String(Math.min(Math.max(Math.trunc(number), 1), 100)));
    } else if (key === "offset" || key === "page") {
      const number = Number(value);
      if (Number.isFinite(number)) result.set(key, String(Math.min(Math.max(Math.trunc(number), 0), 100_000)));
    } else result.set(key, value);
  }
  return result;
}

async function upstreamJson(url: URL, apiKey: string, fetcher: typeof fetch): Promise<unknown> {
  url.searchParams.set("api_key", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, { headers: { Accept: "application/json" }, signal: controller.signal, redirect: "error" });
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new Error("pancake_response_too_large");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("pancake_upstream_failed");
    }
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("pancake_response_too_large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = new TextDecoder().decode(bytes);
    return body ? JSON.parse(body) as unknown : null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeShop(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  const pages = Array.isArray(row.pages) ? row.pages.flatMap((page) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) return [];
    const item = page as Record<string, unknown>;
    const settings = item.settings && typeof item.settings === "object" ? item.settings as Record<string, unknown> : {};
    return [{ id: String(item.id ?? ""), name: String(item.name ?? "Unnamed page"), platform: typeof item.platform === "string" ? item.platform : null, autoCreateOrder: typeof settings.auto_create_order === "boolean" ? settings.auto_create_order : null }];
  }) : [];
  return { id, name: String(row.name ?? `Shop ${id}`), avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null, pages };
}

export async function handleAdminPancakeIntegrationRequest(
  request: Request,
  _database: WorkerDatabaseClient,
  env: Env,
  fetcher: typeof fetch = env.fetch ?? fetch,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = claims.organization_id ?? claims.org_id;
  if (typeof organizationId !== "string" || !organizationId.trim()) return json({ error: "organization_claim_required" }, 403);
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "shops";
  if (resource !== "shops" && resource !== "feature-mappings" && !RESOURCES.has(resource as PancakeResource)) return json({ error: "unsupported_resource" }, 400);
  const payload = (configured: boolean, data: unknown, extra: Record<string, unknown> = {}) => json({ configured, provider: "pancake_pos", resource, data, ...extra });
  if (resource === "feature-mappings") return payload(Boolean(env.PANCAKE_POS_API_KEY?.trim()), POS_FEATURE_MAPPINGS);
  const apiKey = env.PANCAKE_POS_API_KEY?.trim();
  if (!apiKey) return payload(false, [], { message: "Connect Pancake by configuring PANCAKE_POS_API_KEY on the Cloudflare Worker." });
  const base = validBase(env.PANCAKE_POS_API_URL);
  if (!base) return json({ error: "pancake_configuration_invalid" }, 503);
  try {
    if (resource === "shops") {
      const body = await upstreamJson(new URL(`${base.toString()}/shops`), apiKey, fetcher) as { shops?: unknown } | null;
      const shops = Array.isArray(body?.shops) ? body.shops.flatMap((shop) => { const normalized = normalizeShop(shop); return normalized ? [normalized] : []; }) : [];
      return payload(true, shops);
    }
    const shopId = url.searchParams.get("shopId")?.trim();
    if (!shopId || shopId.length > 200) return json({ error: "shop_id_required" }, 400);
    const upstream = new URL(`${base.toString()}${RESOURCE_PATHS[resource as PancakeResource](shopId)}`);
    for (const [key, value] of boundedQuery(url.searchParams)) upstream.searchParams.set(key, value);
    return payload(true, await upstreamJson(upstream, apiKey, fetcher), { shopId });
  } catch (error) {
    const status = error instanceof Error && error.name === "AbortError" ? 503 : 502;
    return json({ error: status === 503 ? "pancake_upstream_timeout" : "pancake_upstream_failed" }, status);
  }
}
