import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";
import {
  executeIdempotently,
  HyperdriveIdempotencyStore,
} from "./idempotency.ts";

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

type AdminShipmentRow = {
  id: string;
  courier_slug: string | null;
  status: string;
  tracking_url: string | null;
  metadata: unknown;
  created_at: string;
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
  updated_at: string | Date;
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
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function requireStaff(
  request: Request,
  env: AdminCommerceEnv,
  permission:
    | "orders:read"
    | "inventory:read"
    | "catalog:read"
    | "catalog:write"
    | "customers:read"
    | "content:read",
): Promise<boolean> {
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    {
      secret: env.JWT_SECRET,
      supabaseUrl: env.SUPABASE_URL,
    },
  );
  if (!claims) return false;
  const role = claims.role;
  if (role === "admin" || role === "owner") return true;
  const permissions = claims.permissions;
  return (
    Array.isArray(permissions) &&
    permissions.some((value) => value === "*" || value === permission)
  );
}

async function staffOrganizationId(
  request: Request,
  env: AdminCommerceEnv,
): Promise<string | undefined> {
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    {
      secret: env.JWT_SECRET,
      supabaseUrl: env.SUPABASE_URL,
    },
  );
  const organizationId = claims?.organization_id ?? claims?.org_id;
  return typeof organizationId === "string" && organizationId.trim()
    ? organizationId.trim()
    : undefined;
}

function pageParams(request: Request): { limit: number; offset: number } {
  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  return {
    limit: Number.isFinite(rawLimit)
      ? Math.min(100, Math.max(1, rawLimit))
      : 50,
    offset: Number.isFinite(rawOffset)
      ? Math.min(100_000, Math.max(0, rawOffset))
      : 0,
  };
}

export async function handleAdminOrdersRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "orders:read")))
    return json({ error: "unauthorized" }, 401);
  const organizationId = await staffOrganizationId(request, env);
  if (!organizationId)
    return json({ error: "organization_scope_required" }, 403);
  const { limit, offset } = pageParams(request);
  const customerId =
    new URL(request.url).searchParams.get("customer_id")?.trim() ?? "";
  const values: unknown[] = [limit, offset, organizationId];
  const customerFilter = customerId ? "AND o.customer_id = $4" : "";
  if (customerId) values.push(customerId);
  const result = await database.query<AdminOrderRow>(
    `SELECT o.id, o.display_id, o.customer_id, o.email,
            COALESCE(NULLIF(o.metadata->>'oms_status', ''), o.status::text) AS status,
            o.currency_code,
            COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total,
            o.created_at,
            COALESCE(SUM(oi.quantity), 0) AS item_count,
            count(*) OVER() AS total_count
       FROM public."order" o
       LEFT JOIN public.order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND COALESCE(o.metadata->>'organization_id', o.metadata->>'store_id') = $3
        ${customerFilter}
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
  return json({
    orders,
    total: Number(
      (result.rows[0] as AdminOrderRow & { total_count?: number })
        ?.total_count ?? orders.length,
    ),
    limit,
    offset,
  });
}

export async function handleAdminOrderDetailRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  orderId: string,
  appDatabase: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "orders:read")))
    return json({ error: "unauthorized" }, 401);
  const organizationId = await staffOrganizationId(request, env);
  if (!organizationId)
    return json({ error: "organization_scope_required" }, 403);
  const result = await database.query<AdminOrderDetailRow>(
    `SELECT o.id, o.display_id, o.customer_id, o.email,
            COALESCE(NULLIF(o.metadata->>'oms_status', ''), o.status::text) AS status,
            o.currency_code,
            COALESCE((SELECT SUM(oi.unit_price * oi.quantity)
              FROM public.order_item oi
             WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), 0) AS total,
            COALESCE((SELECT SUM(oi.unit_price * oi.quantity)
              FROM public.order_item oi
             WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), 0) AS subtotal,
            0::numeric AS shipping_total,
            o.created_at,
            COALESCE(o.metadata, '{}'::jsonb) AS metadata,
            COALESCE((SELECT json_agg(json_build_object(
              'id', oli.id,
              'product_name_snapshot', COALESCE(oli.product_title, oli.title, ''),
              'sku_snapshot', COALESCE(oli.variant_sku, ''),
              'size_snapshot', COALESCE(oli.variant_option_values->>'size', ''),
              'color_snapshot', COALESCE(oli.variant_option_values->>'color', ''),
              'unit_price', COALESCE(oi.unit_price, 0),
              'quantity', COALESCE(oi.quantity, 0),
              'line_total', COALESCE(oi.unit_price, 0) * COALESCE(oi.quantity, 0)) ORDER BY oli.id)
              FROM public.order_item oi
              JOIN public.order_line_item oli ON oli.id = oi.item_id
                AND oli.deleted_at IS NULL
             WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), '[]'::json) AS items,
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
        AND COALESCE(o.metadata->>'organization_id', o.metadata->>'store_id') = $2
      LIMIT 1`,
    [orderId, organizationId],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);
  const persistedShipments = await appDatabase.query<AdminShipmentRow>(
    `SELECT id::text, courier_slug, status, tracking_url, metadata, created_at
           FROM public.delivery_logistics_shipments
          WHERE organization_id = $1 AND order_id = $2
          ORDER BY created_at DESC LIMIT 100`,
    [organizationId, orderId],
  );
  const historicalShipments =
    row.metadata &&
    typeof row.metadata === "object" &&
    Array.isArray(
      (row.metadata as Record<string, unknown>).fulfillment_shipments,
    )
      ? ((row.metadata as Record<string, unknown>)
          .fulfillment_shipments as unknown[])
      : [];
  const shipments = [
    ...persistedShipments.rows.map((shipment) => {
      const metadata =
        shipment.metadata && typeof shipment.metadata === "object"
          ? (shipment.metadata as Record<string, unknown>)
          : {};
      return {
        id: shipment.id,
        tracking_number:
          typeof metadata.tracking_number === "string"
            ? metadata.tracking_number
            : null,
        carrier_slug: shipment.courier_slug,
        status: shipment.status,
        label_url:
          typeof metadata.label_url === "string" ? metadata.label_url : null,
        shipped_at: shipment.created_at,
        tracking_url: shipment.tracking_url,
      };
    }),
    ...historicalShipments,
  ];
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
      metadata:
        row.metadata && typeof row.metadata === "object" ? row.metadata : {},
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
      shipments,
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
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "customers:read")))
    return json({ error: "unauthorized" }, 401);
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
  const result = await database.query<
    AdminCustomerRow & { total_count?: number }
  >(
    `SELECT id, email, first_name, last_name, has_account, created_at,
            COUNT(*) OVER() AS total_count
       FROM public.customer WHERE deleted_at IS NULL
      ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return json({
    customers: result.rows,
    count: Number(result.rows[0]?.total_count ?? 0),
    limit,
    offset,
  });
}

export async function handleAdminInventoryRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "inventory:read")))
    return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variantId")?.trim();
  const inventoryItemId = url.searchParams.get("inventoryItemId")?.trim();
  if (variantId || inventoryItemId) {
    if (variantId && inventoryItemId)
      return json({ error: "provide_one_inventory_identifier" }, 400);
    const organizationId = await staffOrganizationId(request, env);
    if (!organizationId)
      return json(
        {
          error: "organization_scope_required",
          code: "ORGANIZATION_SCOPE_REQUIRED",
        },
        403,
      );
    const requestedLocationId =
      url.searchParams.get("locationId")?.trim() || null;
    const identifier = variantId ?? inventoryItemId!;
    const result = await database.query<{
      product_id: string;
      variant_id: string;
      inventory_item_id: string;
      location_id: string | null;
      stocked_quantity: number | string;
      reserved_quantity: number | string;
    }>(
      `SELECT v.product_id, v.id AS variant_id, pvi.inventory_item_id,
              il.location_id,
              COALESCE(SUM(il.stocked_quantity), 0) AS stocked_quantity,
              COALESCE(SUM(il.reserved_quantity), 0) AS reserved_quantity
         FROM public.product_variant v
         JOIN public.product p ON p.id = v.product_id AND p.deleted_at IS NULL
         LEFT JOIN public.product_variant_inventory_item pvi ON pvi.variant_id = v.id AND pvi.deleted_at IS NULL
         LEFT JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
              AND il.location_id = CASE
                WHEN $1::text IS NULL OR $1 = 'default' THEN
                  (SELECT id FROM public.stock_location WHERE deleted_at IS NULL ORDER BY created_at, id LIMIT 1)
                ELSE $1::uuid
              END
        WHERE (($2::text IS NOT NULL AND v.id = $2) OR ($3::text IS NOT NULL AND pvi.inventory_item_id = $3))
          AND v.deleted_at IS NULL AND p.metadata->>'organization_id' = $4
        GROUP BY v.product_id, v.id, pvi.inventory_item_id, il.location_id LIMIT 1`,
      [
        requestedLocationId,
        variantId ?? null,
        inventoryItemId ?? null,
        organizationId,
      ],
    );
    const row = result.rows[0];
    if (!row) return json({ error: "inventory_variant_not_found" }, 404);
    const stockedQuantity = Number(row.stocked_quantity);
    const reservedQuantity = Number(row.reserved_quantity);
    return json({
      data: {
        productId: row.product_id,
        variantId: row.variant_id,
        inventoryItemId: row.inventory_item_id,
        locationId: row.location_id,
        stockedQuantity,
        reservedQuantity,
        availableQuantity: Math.max(0, stockedQuantity - reservedQuantity),
      },
    });
  }
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
  return json({
    rows,
    total: Number(
      (result.rows[0] as AdminInventoryRow & { total_count?: number })
        ?.total_count ?? rows.length,
    ),
    limit,
    offset,
  });
}

export async function handleAdminCatalogProductsRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "catalog:read")))
    return json({ error: "unauthorized" }, 401);
  const organizationId = await staffOrganizationId(request, env);
  if (!organizationId)
    return json(
      {
        error: "organization_scope_required",
        code: "ORGANIZATION_SCOPE_REQUIRED",
      },
      403,
    );

  const { limit, offset } = pageParams(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = ["draft", "published", "rejected"].includes(
    url.searchParams.get("status") ?? "",
  )
    ? url.searchParams.get("status")
    : null;
  const order = url.searchParams.get("order");
  const orderBy =
    order === "title"
      ? "p.title ASC"
      : order === "-title"
        ? "p.title DESC"
        : "p.created_at DESC";
  const values: unknown[] = [organizationId];
  const where: string[] = [
    "p.deleted_at IS NULL",
    "p.metadata->>'organization_id' = $1",
  ];
  if (q) {
    values.push(`%${q}%`);
    where.push(
      `(p.title ILIKE $${values.length} OR p.handle ILIKE $${values.length})`,
    );
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
                        JOIN public.product_product_option ppo
                          ON ppo.product_option_id = po.id
                         AND ppo.product_id = p.id
                         AND ppo.deleted_at IS NULL
                       WHERE po.deleted_at IS NULL), '[]'::json) AS options,
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
    count: Number(
      (result.rows[0] as AdminCatalogRow & { total_count?: number })
        ?.total_count ?? products.length,
    ),
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
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "catalog:read")))
    return json({ error: "unauthorized" }, 401);
  if (!productId.trim()) return json({ error: "invalid_product_id" }, 400);
  const organizationId = await staffOrganizationId(request, env);

  const result = await database.query<AdminCatalogProductRow>(
    `SELECT p.id, p.title, p.handle, p.description, p.status, p.thumbnail, p.updated_at,
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
              ORDER BY po.id)
              FROM public.product_option po
              JOIN public.product_product_option ppo
                ON ppo.product_option_id = po.id
               AND ppo.product_id = p.id
               AND ppo.deleted_at IS NULL
             WHERE po.deleted_at IS NULL), '[]'::json) AS options,
            COALESCE((SELECT json_agg(json_build_object(
              'id', v.id, 'title', v.title, 'sku', v.sku, 'barcode', v.barcode,
              'metadata', COALESCE(v.metadata, '{}'::jsonb),
              'options', COALESCE((SELECT json_agg(json_build_object(
                'id', pov.id, 'title', po.title, 'value', pov.value)
                ORDER BY po.id)
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
              'inventory_quantity', COALESCE((SELECT SUM(il.stocked_quantity)
                FROM public.product_variant_inventory_item pvi
                JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id
               WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL
                 AND il.deleted_at IS NULL), 0))
              ORDER BY v.variant_rank NULLS LAST, v.id)
              FROM public.product_variant v
             WHERE v.product_id = p.id AND v.deleted_at IS NULL), '[]'::json) AS variants
       FROM public.product p
      WHERE p.id = $1 AND p.deleted_at IS NULL
        AND $2::text IS NOT NULL
        AND p.metadata->>'organization_id' = $2::text
      LIMIT 1`,
    [productId.trim(), organizationId ?? null],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);
  return json({ product: row });
}

export async function handleAdminCatalogProductDeleteRequest(
  request: Request,
  database: WorkerDatabaseClient,
  appDatabase: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  productId: string,
): Promise<Response> {
  if (request.method !== "DELETE")
    return json({ error: "method_not_allowed" }, 405);
  if (!(await requireStaff(request, env, "catalog:write")))
    return json({ error: "unauthorized" }, 401);
  if (!productId.trim()) return json({ error: "invalid_product_id" }, 400);
  const organizationId = await staffOrganizationId(request, env);
  if (!organizationId)
    return json({ error: "organization_claim_required" }, 403);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const requestHash = await requestDigest(
    JSON.stringify({
      method: "DELETE",
      productId: productId.trim(),
      organizationId,
    }),
  );
  const commerceResult = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    `catalog-product-delete:${organizationId}:${idempotencyKey}`,
    requestHash,
    () =>
      withWorkerTransaction(database, async (transaction) => {
        const deleted = await transaction.query<{ id: string }>(
          `UPDATE public.product
            SET deleted_at = now(), status = 'draft', updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
            AND $2::text IS NOT NULL
            AND metadata->>'organization_id' = $2::text
          RETURNING id`,
          [productId.trim(), organizationId ?? null],
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
  if (!commerceResult.response.ok) return commerceResult.response;

  let result: { deleted?: boolean; productId?: string };
  try {
    result = (await commerceResult.response.clone().json()) as typeof result;
  } catch {
    return json({ error: "catalog_delete_response_invalid" }, 502);
  }
  if (result.deleted !== true || result.productId !== productId.trim())
    return commerceResult.response;

  const appRequestHash = await requestDigest(
    JSON.stringify({ requestHash, step: "app-finalize" }),
  );
  try {
    const finalized = await withWorkerTransaction(
      appDatabase,
      async (transaction) =>
        executeIdempotently(
          new HyperdriveIdempotencyStore(transaction),
          `catalog-product-delete-finalize:${organizationId}:${idempotencyKey}`,
          appRequestHash,
          async () => {
            await transaction.query(
              "INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)",
              [
                "catalog.product.delete",
                `product:${productId.trim()}`,
                JSON.stringify({ organization_id: organizationId }),
              ],
            );
            await transaction.query(
              "DELETE FROM public.admin_entity_workflow WHERE organization_id=$1 AND entity_type=$2 AND entity_id=$3",
              [organizationId, "catalog_product", productId.trim()],
            );
            return json(result);
          },
        ),
    );
    return finalized.response;
  } catch {
    // Commerce deletion is already durable. A retry replays it and completes
    // this independently idempotent APP audit/workflow step.
    return json({ error: "catalog_product_finalization_unavailable" }, 503);
  }
}

function categoryHandle(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) || "category"
  );
}

async function requestDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function handleAdminCatalogCategoriesRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: AdminCommerceEnv,
  appDatabase?: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  const permission = request.method === "POST" ? "catalog:write" : null;
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    {
      secret: env.JWT_SECRET,
      supabaseUrl: env.SUPABASE_URL,
    },
  );
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (
    permission
      ? !(await requireStaff(request, env, permission))
      : !(
          claims.role === "admin" ||
          claims.role === "owner" ||
          (Array.isArray(claims.permissions) &&
            claims.permissions.some(
              (value) =>
                value === "*" ||
                value === "catalog:read" ||
                value === "content:read",
            ))
        )
  )
    return json({ error: "unauthorized" }, 401);

  if (request.method === "GET") {
    const result = await database.query<AdminProductCategoryRow>(
      `SELECT id, name, handle FROM public.product_category WHERE deleted_at IS NULL ORDER BY name ASC, id ASC LIMIT 200`,
    );
    return json({ categories: result.rows });
  }

  const organizationId = await staffOrganizationId(request, env);
  if (!organizationId)
    return json({ error: "organization_scope_required" }, 403);
  const actorId = typeof claims.sub === "string" ? claims.sub : "";
  if (!actorId) return json({ error: "staff_subject_required" }, 403);

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  if (!appDatabase) return json({ error: "app_database_not_configured" }, 503);
  const raw = await request.text();
  if (raw.length > 16 * 1024) return json({ error: "payload_too_large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_category_payload" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "invalid_category_payload" }, 400);
  const input = body as { name?: unknown; handle?: unknown };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const handle =
    typeof input.handle === "string" && input.handle.trim()
      ? categoryHandle(input.handle)
      : categoryHandle(name);
  if (!name || name.length > 200 || !handle)
    return json({ error: "invalid_category_payload" }, 400);
  const requestHash = await requestDigest(raw);
  const scopedKey = `catalog-category:${await requestDigest(JSON.stringify({ organizationId, key: idempotencyKey }))}`;
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    scopedKey,
    requestHash,
    () =>
      withWorkerTransaction(database, async (transaction) => {
        const existing = await transaction.query<AdminProductCategoryRow>(
          `SELECT id, name, handle FROM public.product_category WHERE handle = $1 AND deleted_at IS NULL LIMIT 1`,
          [handle],
        );
        if (existing.rows[0])
          return json(
            { error: "category_handle_exists", category: existing.rows[0] },
            409,
          );
        const id = `pcat_${crypto.randomUUID().replaceAll("-", "")}`;
        const inserted = await transaction.query<AdminProductCategoryRow>(
          `INSERT INTO public.product_category (id, name, handle, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, now(), now()) RETURNING id, name, handle`,
          [id, name, handle],
        );
        const category = inserted.rows[0];
        return category
          ? json({ category }, 201)
          : json({ error: "category_create_failed" }, 500);
      }),
  );
  if (!result.response.ok) return result.response;
  let category: AdminProductCategoryRow;
  try {
    const payload = (await result.response.clone().json()) as {
      category?: AdminProductCategoryRow;
    };
    if (!payload.category?.id)
      return json({ error: "category_create_response_invalid" }, 502);
    category = payload.category;
  } catch {
    return json({ error: "category_create_response_invalid" }, 502);
  }
  const finalizeKey = `catalog-category-finalize:${await requestDigest(JSON.stringify({ organizationId, actorId, idempotencyKey }))}`;
  const finalizeHash = await requestDigest(
    JSON.stringify({
      requestHash,
      categoryId: category.id,
      organizationId,
      actorId,
    }),
  );
  try {
    const finalized = await withWorkerTransaction(appDatabase, (transaction) =>
      executeIdempotently(
        new HyperdriveIdempotencyStore(transaction),
        finalizeKey,
        finalizeHash,
        async () => {
          await transaction.query(
            "INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)",
            [
              "catalog.category.create",
              `category:${category.id}`,
              JSON.stringify({
                organization_id: organizationId,
                actor_subject: actorId,
                handle: category.handle,
              }),
            ],
          );
          return json({ category }, 201);
        },
      ),
    );
    return finalized.response;
  } catch {
    return json({ error: "catalog_category_finalization_unavailable" }, 503);
  }
}
