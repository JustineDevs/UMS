import { createSupabaseServerClient } from "./supabase/server";

export type WorkerAdminOrder = {
  id: string;
  order_number: string;
  customer_id: string | null;
  email: string | null;
  status: string;
  channel: string;
  currency: string;
  grand_total: number;
  created_at: string;
};

export type WorkerAdminOrderDetail = WorkerAdminOrder & {
  subtotal: number;
  shipping_fee: number;
  metadata: Record<string, unknown>;
  order_items: Array<{
    id: string;
    sku_snapshot: string;
    product_name_snapshot: string;
    size_snapshot: string;
    color_snapshot: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
  shipments?: Array<{
    id: string;
    tracking_number?: string | null;
    carrier_slug?: string | null;
    status?: string | null;
    label_url?: string | null;
    shipped_at?: string | null;
  }>;
};

export type WorkerAdminPayment = {
  id: string;
  amount: number;
  currency_code: string;
  captured_amount?: number;
  refunded_amount?: number;
};

export type WorkerAdminInventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  available: number;
};

export type WorkerAdminCatalogProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  variantCount: number;
  created_at: string;
  categories: Array<{ id?: string; name?: string }>;
  options: Array<{ title?: string }>;
  variants: Array<{ id?: string; sku?: string }>;
};

export type WorkerAdminCatalogProductDetail = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  status: string;
  thumbnail: string | null;
  metadata: Record<string, unknown>;
  images: Array<{ id?: string; url?: string; rank?: number | null }>;
  categories: Array<{ id?: string; name?: string; handle?: string }>;
  options: Array<{
    id?: string;
    title?: string;
    values?: Array<{ id?: string; value?: string }>;
  }>;
  variants: Array<{
    id: string;
    title?: string | null;
    sku?: string | null;
    barcode?: string | null;
    metadata?: Record<string, unknown>;
    options?: Array<{ id?: string; title?: string; value?: string }>;
    prices?: Array<{ amount?: number | string; currency_code?: string | null }>;
    inventory_quantity?: number | string | null;
  }>;
};

export type WorkerAdminCustomer = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_account: boolean;
  created_at: string;
};

export type WorkerAdminProductCategory = {
  id: string;
  name: string;
  handle: string;
};

function isWorkerAdminProductCategory(value: unknown): value is WorkerAdminProductCategory {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.handle === "string";
}

async function workerAdminRequest(path: string, signal?: AbortSignal): Promise<Response | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return null;
  return fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal,
  });
}

async function workerAdminMutation(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<Response | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return null;
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function fetchWorkerProductCategoriesForAdmin(): Promise<WorkerAdminProductCategory[] | null> {
  try {
    const response = await workerAdminRequest("/api/admin/catalog/categories");
    if (!response?.ok) return null;
    const payload = (await response.json()) as { categories?: unknown };
    return Array.isArray(payload.categories)
      ? payload.categories.filter(isWorkerAdminProductCategory)
      : [];
  } catch {
    return null;
  }
}

export async function createWorkerProductCategoryForAdmin(input: {
  name: string;
  handle?: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/catalog/categories",
    "POST",
    { name: input.name, ...(input.handle ? { handle: input.handle } : {}) },
    input.idempotencyKey,
  );
}

export async function deleteWorkerCatalogProductForAdmin(input: {
  productId: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    `/api/admin/catalog/products/${encodeURIComponent(input.productId)}`,
    "DELETE",
    {},
    input.idempotencyKey,
  );
}

export async function createWorkerCatalogProductForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation("/api/admin/catalog/products", "POST", input.body, input.idempotencyKey);
}

export async function updateWorkerCatalogProductForAdmin(input: {
  productId: string;
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(`/api/admin/catalog/products/${encodeURIComponent(input.productId)}`, "PATCH", input.body, input.idempotencyKey);
}

export async function syncWorkerCatalogProviderForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/catalog/provider-sync",
    "POST",
    { ...input.body, idempotencyKey: input.idempotencyKey },
    input.idempotencyKey,
  );
}

export async function archiveWorkerCatalogProviderForAdmin(input: {
  body: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    "/api/admin/catalog/provider-sync",
    "DELETE",
    { ...input.body, idempotencyKey: input.idempotencyKey },
    input.idempotencyKey,
  );
}

export async function deleteWorkerCatalogMediaForAdmin(input: {
  mediaId: string;
  idempotencyKey: string;
}): Promise<Response | null> {
  return workerAdminMutation(
    `/api/admin/cms/media/${encodeURIComponent(input.mediaId)}`,
    "DELETE",
    {},
    input.idempotencyKey,
  );
}

export async function uploadWorkerCatalogMediaForAdmin(
  form: FormData,
  idempotencyKey: string,
): Promise<Response | null> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return null;
  return fetch(`${base}/api/admin/catalog/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: form,
    cache: "no-store",
  });
}

export async function fetchWorkerOrdersForAdmin(limit = 50, offset = 0, customerId?: string): Promise<{
  orders: WorkerAdminOrder[];
  total: number;
  commerceUnavailable?: boolean;
}> {
  try {
    const customerQuery = customerId ? `&customer_id=${encodeURIComponent(customerId)}` : "";
    const response = await workerAdminRequest(`/api/admin/orders?limit=${limit}&offset=${offset}${customerQuery}`);
    if (!response?.ok) return { orders: [], total: 0, commerceUnavailable: true };
    const payload = (await response.json()) as { orders?: WorkerAdminOrder[]; total?: number };
    return {
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      total: typeof payload.total === "number" ? payload.total : 0,
    };
  } catch {
    return { orders: [], total: 0, commerceUnavailable: true };
  }
}

export async function fetchWorkerOrderDetailForAdmin(orderId: string): Promise<{
  order: WorkerAdminOrderDetail;
  payments: WorkerAdminPayment[];
} | null> {
  try {
    const response = await workerAdminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}`);
    if (!response?.ok) return null;
    const payload = (await response.json()) as {
      order?: WorkerAdminOrderDetail;
      payments?: WorkerAdminPayment[];
    };
    return payload.order ? { order: payload.order, payments: Array.isArray(payload.payments) ? payload.payments : [] } : null;
  } catch {
    return null;
  }
}

export async function fetchWorkerCustomersForAdmin(limit = 100): Promise<WorkerAdminCustomer[]> {
  try {
    const response = await workerAdminRequest(`/api/admin/customers?limit=${Math.min(100, Math.max(1, limit))}&offset=0`);
    if (!response?.ok) return [];
    const payload = (await response.json()) as { customers?: WorkerAdminCustomer[] };
    return Array.isArray(payload.customers) ? payload.customers : [];
  } catch {
    return [];
  }
}

export async function fetchWorkerCustomerById(id: string): Promise<WorkerAdminCustomer | null> {
  try {
    const response = await workerAdminRequest(`/api/admin/customers/${encodeURIComponent(id)}`);
    if (!response?.ok) return null;
    const payload = (await response.json()) as { customer?: WorkerAdminCustomer };
    return payload.customer ?? null;
  } catch {
    return null;
  }
}

export async function fetchWorkerInventoryPage(opts: { limit: number; offset: number; signal?: AbortSignal }): Promise<{
  rows: WorkerAdminInventoryRow[];
  total: number;
}> {
  try {
    const response = await workerAdminRequest(`/api/admin/inventory?limit=${opts.limit}&offset=${opts.offset}`, opts.signal);
    if (!response?.ok) return { rows: [], total: 0 };
    const payload = (await response.json()) as { rows?: WorkerAdminInventoryRow[]; total?: number };
    return {
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      total: typeof payload.total === "number" ? payload.total : 0,
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function fetchWorkerCatalogProductsForAdmin(opts: {
  limit: number;
  offset: number;
  q?: string;
  status?: string;
  order?: string;
}): Promise<{
  products: WorkerAdminCatalogProduct[];
  count: number;
  commerceUnavailable?: boolean;
}> {
  try {
    const qs = new URLSearchParams({
      limit: String(opts.limit),
      offset: String(opts.offset),
    });
    if (opts.q?.trim()) qs.set("q", opts.q.trim());
    if (opts.status) qs.set("status", opts.status);
    if (opts.order) qs.set("order", opts.order);
    const response = await workerAdminRequest(`/api/admin/catalog/products?${qs.toString()}`);
    if (!response?.ok) return { products: [], count: 0, commerceUnavailable: true };
    const payload = (await response.json()) as {
      products?: WorkerAdminCatalogProduct[];
      count?: number;
    };
    return {
      products: Array.isArray(payload.products) ? payload.products : [],
      count: typeof payload.count === "number" ? payload.count : 0,
    };
  } catch {
    return { products: [], count: 0, commerceUnavailable: true };
  }
}

export async function fetchWorkerCatalogProductDetailForAdmin(
  productId: string,
): Promise<WorkerAdminCatalogProductDetail | null> {
  try {
    const response = await workerAdminRequest(
      `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
    );
    if (!response?.ok) return null;
    const payload = (await response.json()) as {
      product?: WorkerAdminCatalogProductDetail;
    };
    return payload.product ?? null;
  } catch {
    return null;
  }
}

export async function fetchWorkerCatalogMediaForAdmin(opts: {
  limit: number;
  q?: string;
  mime?: string;
  sort?: string;
}): Promise<{ data: Array<Record<string, unknown>> } | null> {
  try {
    const qs = new URLSearchParams({
      limit: String(opts.limit),
      tag: "catalog-product",
      sort: opts.sort ?? "created_desc",
    });
    if (opts.q?.trim()) qs.set("q", opts.q.trim());
    if (opts.mime?.trim()) qs.set("mime", opts.mime.trim());
    const response = await workerAdminRequest(`/api/admin/cms/media?${qs.toString()}`);
    if (!response?.ok) return null;
    const payload = (await response.json()) as { data?: unknown };
    return { data: Array.isArray(payload.data) ? payload.data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [] };
  } catch {
    return null;
  }
}
