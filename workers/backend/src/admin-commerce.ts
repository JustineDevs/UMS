import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

export type AdminCommerceEnv = {
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
};

type AdminOrderRow = {
  id: string;
  display_id: string | number;
  customer_id: string | null;
  email: string | null;
  status: string;
  currency_code: string;
  total: string | number;
  created_at: string;
  item_count: string | number;
};

type AdminOrderDetailRow = AdminOrderRow & {
  subtotal: string | number;
  shipping_total: string | number;
  metadata: unknown;
  items: unknown;
  payments: unknown;
};

type AdminOrderItem = {
  id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
  unit_price: string | number;
  quantity: string | number;
  line_total: string | number;
};

type AdminInventoryRow = {
  variant_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  available: string | number;
};

type AdminCatalogRow = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  created_at: string;
  variant_count: string | number;
  categories: unknown;
  options: unknown;
  variants: unknown;
};

type AdminCatalogProductRow = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  status: string;
  thumbnail: string | null;
  metadata: unknown;
  images: unknown;
  categories: unknown;
  options: unknown;
  variants: unknown;
};

type AdminCustomerRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_account: boolean | null;
  created_at: string;
};

type AdminProductCategoryRow = {
  id: string;
  name: string;
  handle: string;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function requireStaff(
  request: Request,
  env: AdminCommerceEnv,
  permission: "orders:read" | "inventory:read" | "catalog:read" | "catalog:write" | "customers:read",
): Promise<boolean> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  if (!claims) return false;
  const role = claims.role;
  if (role === "admin" || role === "owner") return true;
  const permissions = claims.permissions;
  return Array.isArray(permissions) && permissions.some((value) => value === "*" || value === permission);
}

function pageParams(request: Request): { limit: number; offset: number } {
  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  return {
    limit: Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0,
  };
}

export async function handleAdminOrdersRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "orders:read"))) return json({ error: "unauthorized" }, 401);
  const { limit, offset } = pageParams(request);
  const customerId = new URL(request.url).searchParams.get("customer_id")?.trim() ?? "";
  const values: unknown[] = [limit, offset];
  const customerFilter = customerId ? "AND o.customer_id = $3" : "";
  if (customerId) values.push(customerId);
  const result = await database.query<AdminOrderRow>(
    `SELECT o.id, o.display_id, o.customer_id, o.email, o.status,
            o.currency_code, o.total, o.created_at,
            COALESCE(SUM(oi.quantity), 0) AS item_count,
            count(*) OVER() AS total_count
       FROM public."order" o
       LEFT JOIN public.order_line_item oli ON oli.order_id = o.id AND oli.deleted_at IS NULL
       LEFT JOIN public.order_item oi ON oi.order_id = o.id AND oi.item_id = oli.id AND oi.deleted_at IS NULL
      WHERE o.deleted_at IS NULL ${customerFilter}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2`,
    values,
  );
  const orders = result.rows.map((row) => ({
    id: row.id,
    order_number: String(row.display_id),
    customer_id: row.customer_id,
    email: row.email,
    status: row.status,
    channel: "worker",
    currency: String(row.currency_code).toUpperCase(),
    grand_total: Number(row.total) / 100,
    item_count: Number(row.item_count),
    created_at: row.created_at,
  }));
  return json({ orders, total: Number((result.rows[0] as AdminOrderRow & { total_count?: number })?.total_count ?? orders.length), limit, offset });
}

export async function handleAdminOrderDetailRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  orderId: string,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "orders:read"))) return json({ error: "unauthorized" }, 401);
  const result = await database.query<AdminOrderDetailRow>(
    `SELECT o.id, o.display_id, o.customer_id, o.email, o.status,
            o.currency_code, o.total, o.subtotal, o.shipping_total, o.created_at,
            COALESCE(o.metadata, '{}'::jsonb) AS metadata,
            COALESCE((SELECT json_agg(json_build_object(
              'id', oli.id,
              'product_name_snapshot', COALESCE(oli.product_title, oli.title, ''),
              'sku_snapshot', COALESCE(oli.variant_sku, ''),
              'size_snapshot', COALESCE(oli.variant_option_values->>'size', ''),
              'color_snapshot', COALESCE(oli.variant_option_values->>'color', ''),
              'unit_price', COALESCE(oi.unit_price, oli.unit_price, 0),
              'quantity', COALESCE(oi.quantity, 0),
              'line_total', COALESCE(oi.unit_price, oli.unit_price, 0) * COALESCE(oi.quantity, 0)) ORDER BY oli.id)
              FROM public.order_line_item oli
              LEFT JOIN public.order_item oi ON oi.item_id = oli.id
                AND oi.order_id = o.id AND oi.deleted_at IS NULL
             WHERE oli.order_id = o.id AND oli.deleted_at IS NULL), '[]'::json) AS items,
            COALESCE((SELECT json_agg(json_build_object(
              'id', p.id, 'amount', p.amount, 'currency_code', p.currency_code,
              'captured_amount', COALESCE((p.data->>'captured_amount_minor')::numeric, p.amount),
              'refunded_amount', COALESCE((p.data->>'refunded_amount_minor')::numeric, 0)) ORDER BY p.created_at)
              FROM public.order_payment_collection opc
              JOIN public.payment_collection pc ON pc.id = opc.payment_collection_id
              JOIN public.payment p ON p.payment_collection_id = pc.id
             WHERE opc.order_id = o.id AND p.deleted_at IS NULL), '[]'::json) AS payments
       FROM public."order" o
      WHERE o.id = $1 AND o.deleted_at IS NULL
      LIMIT 1`,
    [orderId],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);
  return json({
    order: {
      id: row.id,
      order_number: String(row.display_id),
      customer_id: row.customer_id,
      status: row.status,
      channel: "worker",
      currency: String(row.currency_code).toUpperCase(),
      subtotal: Number(row.subtotal) / 100,
      shipping_fee: Number(row.shipping_total) / 100,
      grand_total: Number(row.total) / 100,
      created_at: row.created_at,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      order_items: Array.isArray(row.items)
        ? (row.items as AdminOrderItem[]).map((item) => ({
            id: item.id,
            sku_snapshot: item.sku_snapshot,
            product_name_snapshot: item.product_name_snapshot,
            size_snapshot: item.size_snapshot,
            color_snapshot: item.color_snapshot,
            unit_price: Number(item.unit_price) / 100,
            quantity: Number(item.quantity),
            line_total: Number(item.line_total) / 100,
          }))
        : [],
      shipments:
        row.metadata && typeof row.metadata === "object" &&
        Array.isArray((row.metadata as Record<string, unknown>).fulfillment_shipments)
          ? (row.metadata as Record<string, unknown>).fulfillment_shipments
          : [],
    },
    payments: Array.isArray(row.payments) ? row.payments : [],
  });
}

export async function handleAdminCustomersRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  customerId?: string,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "customers:read"))) return json({ error: "unauthorized" }, 401);
  if (customerId) {
    const result = await database.query<AdminCustomerRow>(
      `SELECT id, email, first_name, last_name, has_account, created_at
         FROM public.customer WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [customerId],
    );
    const row = result.rows[0];
    return row ? json({ customer: row }) : json({ error: "not_found" }, 404);
  }
  const { limit, offset } = pageParams(request);
  const result = await database.query<AdminCustomerRow & { total_count?: number }>(
    `SELECT id, email, first_name, last_name, has_account, created_at,
            COUNT(*) OVER() AS total_count
       FROM public.customer WHERE deleted_at IS NULL
      ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return json({ customers: result.rows, count: Number(result.rows[0]?.total_count ?? 0), limit, offset });
}

export async function handleAdminInventoryRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "inventory:read"))) return json({ error: "unauthorized" }, 401);
  const { limit, offset } = pageParams(request);
  const result = await database.query<AdminInventoryRow>(
    `SELECT v.id AS variant_id, v.product_id, COALESCE(p.title, v.title, '') AS product_name,
            COALESCE(v.sku, '') AS sku,
            COALESCE(MAX(CASE WHEN lower(po.title) = 'size' THEN pov.value END), '') AS size,
            COALESCE(MAX(CASE WHEN lower(po.title) = 'color' THEN pov.value END), '') AS color,
            COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS available,
            count(*) OVER() AS total_count
       FROM public.product_variant v
       LEFT JOIN public.product p ON p.id = v.product_id AND p.deleted_at IS NULL
       LEFT JOIN public.product_variant_inventory_item pvi ON pvi.variant_id = v.id AND pvi.deleted_at IS NULL
       LEFT JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
       LEFT JOIN public.product_variant_option pvo ON pvo.variant_id = v.id
       LEFT JOIN public.product_option_value pov ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
       LEFT JOIN public.product_option po ON po.id = pov.option_id AND po.deleted_at IS NULL
      WHERE v.deleted_at IS NULL
      GROUP BY v.id, p.title
      ORDER BY p.title NULLS LAST, v.id
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const rows = result.rows.map((row) => ({
    variantId: row.variant_id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    size: row.size,
    color: row.color,
    available: Math.max(0, Number(row.available)),
  }));
  return json({ rows, total: Number((result.rows[0] as AdminInventoryRow & { total_count?: number })?.total_count ?? rows.length), limit, offset });
}

export async function handleAdminCatalogProductsRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "catalog:read"))) return json({ error: "unauthorized" }, 401);

  const { limit, offset } = pageParams(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = ["draft", "published", "rejected"].includes(url.searchParams.get("status") ?? "")
    ? url.searchParams.get("status")
    : null;
  const order = url.searchParams.get("order");
  const orderBy = order === "title" ? "p.title ASC" : order === "-title" ? "p.title DESC" : "p.created_at DESC";
  const values: unknown[] = [];
  const where: string[] = ["p.deleted_at IS NULL"];
  if (q) {
    values.push(`%${q}%`);
    where.push(`(p.title ILIKE $${values.length} OR p.handle ILIKE $${values.length})`);
  }
  if (status) {
    values.push(status);
    where.push(`p.status = $${values.length}`);
  }
  values.push(limit, offset);
  const result = await database.query<AdminCatalogRow>(
    `SELECT p.id, p.title, p.handle, p.status, p.thumbnail, p.created_at,
            COUNT(DISTINCT v.id) AS variant_count,
            COALESCE((SELECT json_agg(json_build_object('id', pc.id, 'name', pc.name) ORDER BY pc.name)
                        FROM public.product_category_product pcp
                        JOIN public.product_category pc ON pc.id = pcp.product_category_id
                       WHERE pcp.product_id = p.id AND pc.deleted_at IS NULL), '[]'::json) AS categories,
            COALESCE((SELECT json_agg(json_build_object('title', po.title) ORDER BY po.title)
                        FROM public.product_option po
                       WHERE po.product_id = p.id AND po.deleted_at IS NULL), '[]'::json) AS options,
            COALESCE((SELECT json_agg(json_build_object('id', v2.id, 'sku', v2.sku) ORDER BY v2.id)
                        FROM public.product_variant v2
                       WHERE v2.product_id = p.id AND v2.deleted_at IS NULL), '[]'::json) AS variants,
            COUNT(*) OVER() AS total_count
       FROM public.product p
       LEFT JOIN public.product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
      WHERE ${where.join(" AND ")}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const products = result.rows.map((row) => ({
    id: row.id,
    title: row.title ?? "",
    handle: row.handle ?? "",
    status: row.status ?? "",
    thumbnail: row.thumbnail,
    variantCount: Number(row.variant_count ?? 0),
    created_at: row.created_at,
    categories: Array.isArray(row.categories) ? row.categories : [],
    options: Array.isArray(row.options) ? row.options : [],
    variants: Array.isArray(row.variants) ? row.variants : [],
  }));
  return json({
    products,
    count: Number((result.rows[0] as AdminCatalogRow & { total_count?: number })?.total_count ?? products.length),
    limit,
    offset,
  });
}

export async function handleAdminCatalogProductRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  productId: string,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "catalog:read"))) return json({ error: "unauthorized" }, 401);
  if (!productId.trim()) return json({ error: "invalid_product_id" }, 400);

  const result = await database.query<AdminCatalogProductRow>(
    `SELECT p.id, p.title, p.handle, p.description, p.status, p.thumbnail,
            COALESCE(p.metadata, '{}'::jsonb) AS metadata,
            COALESCE((SELECT json_agg(json_build_object(
              'id', pi.id, 'url', pi.url, 'rank', pi.rank)
              ORDER BY pi.rank NULLS LAST, pi.id)
              FROM public.image pi
             WHERE pi.product_id = p.id AND pi.deleted_at IS NULL), '[]'::json) AS images,
            COALESCE((SELECT json_agg(json_build_object(
              'id', pc.id, 'name', pc.name, 'handle', pc.handle)
              ORDER BY pc.name)
              FROM public.product_category_product pcp
              JOIN public.product_category pc ON pc.id = pcp.product_category_id
             WHERE pcp.product_id = p.id AND pc.deleted_at IS NULL), '[]'::json) AS categories,
            COALESCE((SELECT json_agg(json_build_object(
              'id', po.id, 'title', po.title,
              'values', COALESCE((SELECT json_agg(json_build_object(
                'id', pov.id, 'value', pov.value)
                ORDER BY pov.rank NULLS LAST, pov.id)
                FROM public.product_option_value pov
               WHERE pov.option_id = po.id AND pov.deleted_at IS NULL), '[]'::json))
              ORDER BY po.rank NULLS LAST, po.id)
              FROM public.product_option po
             WHERE po.product_id = p.id AND po.deleted_at IS NULL), '[]'::json) AS options,
            COALESCE((SELECT json_agg(json_build_object(
              'id', v.id, 'title', v.title, 'sku', v.sku, 'barcode', v.barcode,
              'metadata', COALESCE(v.metadata, '{}'::jsonb),
              'options', COALESCE((SELECT json_agg(json_build_object(
                'id', pov.id, 'title', po.title, 'value', pov.value)
                ORDER BY po.rank NULLS LAST, po.id)
                FROM public.product_variant_option pvo
                JOIN public.product_option_value pov ON pov.id = pvo.option_value_id
                  AND pov.deleted_at IS NULL
                JOIN public.product_option po ON po.id = pov.option_id
                  AND po.deleted_at IS NULL
               WHERE pvo.variant_id = v.id), '[]'::json),
              'prices', COALESCE((SELECT json_agg(json_build_object(
                'amount', pr.amount, 'currency_code', pr.currency_code)
                ORDER BY CASE WHEN pr.currency_code = 'php' THEN 0 ELSE 1 END, pr.amount)
                FROM public.product_variant_price_set pvps
                JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
               WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL
                 AND pr.deleted_at IS NULL), '[]'::json),
              'inventory_quantity', COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
                FROM public.product_variant_inventory_item pvi
                JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id
               WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL
                 AND il.deleted_at IS NULL), 0))
              ORDER BY v.variant_rank NULLS LAST, v.id)
              FROM public.product_variant v
             WHERE v.product_id = p.id AND v.deleted_at IS NULL), '[]'::json) AS variants
       FROM public.product p
      WHERE p.id = $1 AND p.deleted_at IS NULL
      LIMIT 1`,
    [productId.trim()],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);
  return json({ product: row });
}

export async function handleAdminCatalogProductDeleteRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  productId: string,
): Promise<Response> {
  if (request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "catalog:write"))) return json({ error: "unauthorized" }, 401);
  if (!productId.trim()) return json({ error: "invalid_product_id" }, 400);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const requestHash = await requestDigest(productId.trim());
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    idempotencyKey,
    requestHash,
    () => withWorkerTransaction(database, async (transaction) => {
      const deleted = await transaction.query<{ id: string }>(
        `UPDATE public.product
            SET deleted_at = now(), status = 'draft', updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [productId.trim()],
      );
      if (!deleted.rows[0]) return json({ error: "not_found" }, 404);
      await transaction.query(
        `UPDATE public.product_variant
            SET deleted_at = now(), updated_at = now()
          WHERE product_id = $1 AND deleted_at IS NULL`,
        [productId.trim()],
      );
      return json({ deleted: true, productId: deleted.rows[0].id });
    }),
  );
  return result.response;
}

function categoryHandle(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200) || "category";
}

async function requestDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleAdminCatalogCategoriesRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const permission = request.method === "POST" ? "catalog:write" : "catalog:read";
  if (!(await requireStaff(request, env, permission))) return json({ error: "unauthorized" }, 401);

  if (request.method === "GET") {
    const result = await database.query<AdminProductCategoryRow>(
      `SELECT id, name, handle FROM public.product_category WHERE deleted_at IS NULL ORDER BY name ASC, id ASC LIMIT 200`,
    );
    return json({ categories: result.rows });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  if (raw.length > 16 * 1024) return json({ error: "payload_too_large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_category_payload" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_category_payload" }, 400);
  const input = body as { name?: unknown; handle?: unknown };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const handle = typeof input.handle === "string" && input.handle.trim()
    ? categoryHandle(input.handle)
    : categoryHandle(name);
  if (!name || name.length > 200 || !handle) return json({ error: "invalid_category_payload" }, 400);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    idempotencyKey,
    await requestDigest(raw),
    () => withWorkerTransaction(database, async (transaction) => {
      const existing = await transaction.query<AdminProductCategoryRow>(
        `SELECT id, name, handle FROM public.product_category WHERE handle = $1 AND deleted_at IS NULL LIMIT 1`,
        [handle],
      );
      if (existing.rows[0]) return json({ error: "category_handle_exists", category: existing.rows[0] }, 409);
      const id = `pcat_${crypto.randomUUID().replaceAll("-", "")}`;
      const inserted = await transaction.query<AdminProductCategoryRow>(
        `INSERT INTO public.product_category (id, name, handle, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, now(), now()) RETURNING id, name, handle`,
        [id, name, handle],
      );
      const category = inserted.rows[0];
      return category ? json({ category }, 201) : json({ error: "category_create_failed" }, 500);
    }),
  );
  return result.response;
}
