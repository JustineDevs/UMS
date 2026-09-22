import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

export type OrderReadEnv = { JWT_SECRET?: string; SUPABASE_URL?: string };
const MAX_ORDER_OFFSET = 100_000;
type OrderRow = {
  id: string;
  display_id: string | number;
  status: string;
  total: string | number;
  currency_code: string;
  created_at: string;
  item_count: string | number;
};

type CustomerOrderDetailRow = OrderRow & {
  customer_id: string | null;
  email: string | null;
  subtotal: string | number | null;
  tax_total: string | number | null;
  shipping_total: string | number | null;
  discount_total: string | number | null;
  updated_at: string;
  payment_status: string | null;
  fulfillment_status: string | null;
  metadata: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
};

type CustomerOrderItemRow = {
  id: string;
  title: string | null;
  quantity: number | string;
  unit_price: number | string;
  variant_sku: string | null;
  thumbnail: string | null;
};

function claimsEmail(claims: Awaited<ReturnType<typeof verifyWorkerBearerToken>>): string | null {
  const value = claims?.email;
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleCustomerOrdersRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: OrderReadEnv,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL },
  );
  if (!claims) return json({ error: "unauthorized" }, 401);
  const email = claimsEmail(claims);
  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
    ),
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );
  const result = await database.query<OrderRow>(
    `SELECT o.id, o.display_id, o.status,
            COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total,
            o.currency_code, o.created_at,
            COALESCE(SUM(oi.quantity), 0) AS item_count
     FROM public."order" o
     LEFT JOIN public.order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
     WHERE o.deleted_at IS NULL
       AND (o.customer_id = $1 OR ($2::text IS NOT NULL AND lower(o.email) = $2::text))
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT $3 OFFSET $4`,
    [claims.sub, email, limit, Math.min(MAX_ORDER_OFFSET, offset)],
  );
  return json({ orders: result.rows, limit, offset: Math.min(MAX_ORDER_OFFSET, offset) });
}

export async function handleCustomerOrderDetailRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: OrderReadEnv,
  orderId: string,
): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL },
  );
  if (!claims) return json({ error: "unauthorized" }, 401);
  const email = claimsEmail(claims);
  if (!/^order_[A-Za-z0-9_-]+$/.test(orderId))
    return json({ error: "not_found" }, 404);
  const result = await database.query<CustomerOrderDetailRow>(
    `SELECT o.id, o.display_id, o.status,
            COALESCE((SELECT SUM(oi.unit_price * oi.quantity)
              FROM public.order_item oi
             WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), 0) AS total,
            COALESCE((SELECT SUM(oi.unit_price * oi.quantity)
              FROM public.order_item oi
             WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), 0) AS subtotal,
            0::numeric AS tax_total,
            0::numeric AS shipping_total,
            0::numeric AS discount_total,
            o.currency_code, o.created_at,
            o.updated_at,
            COALESCE((SELECT pc.status
                FROM public.order_payment_collection opc
                JOIN public.payment_collection pc ON pc.id = opc.payment_collection_id
               WHERE opc.order_id = o.id AND opc.deleted_at IS NULL AND pc.deleted_at IS NULL
               ORDER BY pc.created_at DESC LIMIT 1), 'pending') AS payment_status,
            NULL::text AS fulfillment_status, o.customer_id,
            o.email, o.metadata,
            CASE WHEN oa.id IS NULL THEN NULL ELSE jsonb_build_object(
              'first_name', oa.first_name, 'last_name', oa.last_name,
              'phone', oa.phone, 'address_1', oa.address_1, 'address_2', oa.address_2,
              'city', oa.city, 'province', oa.province, 'postal_code', oa.postal_code,
              'country_code', oa.country_code
            ) END AS shipping_address,
            COALESCE((SELECT SUM(oi.quantity)
                FROM public.order_item oi
               WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), 0) AS item_count
     FROM public."order" o
     LEFT JOIN public.order_address oa ON oa.id = o.shipping_address_id
     WHERE o.id = $1 AND o.deleted_at IS NULL
       AND (o.customer_id = $2 OR ($3::text IS NOT NULL AND lower(o.email) = $3::text))
     LIMIT 1`,
    [orderId, claims.sub, email],
  );
  const row = result.rows[0];
  if (!row) return json({ error: "not_found" }, 404);

  const items = await database.query<CustomerOrderItemRow>(
    `SELECT oli.id, oli.title, oi.quantity, oi.unit_price,
            oli.variant_sku, oli.thumbnail
       FROM public.order_item oi
       JOIN public.order_line_item oli ON oli.id = oi.item_id AND oli.deleted_at IS NULL
       JOIN public."order" o ON o.id = oi.order_id
      WHERE oi.order_id = $1 AND oi.deleted_at IS NULL AND o.deleted_at IS NULL
      ORDER BY oli.created_at, oli.id`,
    [orderId],
  );
  const normalizedItems = items.rows.map((item) => ({
    id: item.id,
    title: item.title,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total: Number(item.unit_price) * Number(item.quantity),
    variant: item.variant_sku ? { sku: item.variant_sku } : null,
    thumbnail: item.thumbnail,
  }));
  return json({
    order: {
      ...row,
      items: normalizedItems,
      fulfillments: [],
    },
  });
}

export async function handleCustomerReceiptRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: OrderReadEnv,
  orderId: string,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !/^order_[A-Za-z0-9_-]+$/.test(orderId)) return json({ error: "not_found" }, 404);
  const email = claimsEmail(claims);
  const result = await database.query<{ id: string; order_id: string; customer_email: string | null; receipt_html: string; sent_at: string | null; created_at: string }>(
    `SELECT r.id, r.order_id, r.customer_email, r.receipt_html, r.sent_at, r.created_at
       FROM public.digital_receipts r
       JOIN public."order" o ON o.id = r.order_id
      WHERE r.order_id = $1 AND o.deleted_at IS NULL
        AND (o.customer_id = $2 OR ($3::text IS NOT NULL AND lower(o.email) = $3::text))
      LIMIT 1`,
    [orderId, claims.sub, email],
  );
  return result.rows[0] ? json({ receipt: result.rows[0] }) : json({ error: "not_found" }, 404);
}
