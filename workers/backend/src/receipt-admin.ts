import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import {
  executeIdempotently,
  HyperdriveIdempotencyStore,
} from "./idempotency.ts";
import { sendResendEmail } from "./resend.ts";

type Env = {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM?: string;
  STORE_NAME?: string;
};

type Order = {
  id: string;
  display_id: number | string;
  email: string | null;
  total: number | string;
  currency_code: string;
  created_at: string;
};

type Item = {
  title: string | null;
  quantity: number | string;
  unit_price: number | string;
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

function tenant(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasPermission(claims: WorkerAuthClaims, permission: string): boolean {
  const permissions = Array.isArray(claims.permissions)
    ? claims.permissions
    : [];
  return (
    claims.role === "owner" ||
    claims.role === "admin" ||
    permissions.some((entry) => entry === "*" || entry === permission)
  );
}

async function authorize(
  request: Request,
  env: Env,
  permission: string,
): Promise<WorkerAuthClaims | Response> {
  const claims = await verifyWorkerBearerToken(
    request.headers.get("Authorization"),
    {
      secret: env.CMS_ADMIN_JWT_SECRET,
      supabaseUrl: env.SUPABASE_URL,
    },
  );
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!hasPermission(claims, permission))
    return json({ error: "forbidden" }, 403);
  if (!tenant(claims))
    return json({ error: "organization_scope_required" }, 403);
  return claims;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

function receiptHtml(order: Order, items: Item[], storeName: string): string {
  const rows = items
    .map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      return `<tr><td>${escapeHtml(item.title)}</td><td>${quantity}</td><td>${(unitPrice / 100).toFixed(2)}</td><td>${((unitPrice * quantity) / 100).toFixed(2)}</td></tr>`;
    })
    .join("");
  const date = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(order.created_at));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${escapeHtml(order.display_id)}</title></head><body style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h1>${escapeHtml(storeName)}</h1><p>Order #${escapeHtml(order.display_id)} · ${escapeHtml(date)}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Unit price</th><th align="right">Total</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:right;font-size:18px"><strong>Total: ${escapeHtml(order.currency_code.toUpperCase())} ${(Number(order.total) / 100).toFixed(2)}</strong></p><p>Thank you for your purchase.</p></body></html>`;
}

async function resolveOrder(
  database: WorkerDatabaseClient,
  reference: string,
  organizationId: string,
): Promise<Order | null> {
  const result = await database.query<Order>(
    `SELECT id, display_id, email,
            COALESCE((SELECT SUM(oi.unit_price * oi.quantity)
                        FROM public.order_item oi
                       WHERE oi.order_id = o.id AND oi.deleted_at IS NULL), 0) AS total,
            currency_code, created_at
       FROM public."order" AS o
      WHERE o.deleted_at IS NULL
        AND COALESCE(o.metadata->>'organization_id', o.metadata->>'store_id') = $2
        AND (o.id = $1 OR o.display_id::text = $1)
      ORDER BY CASE WHEN o.id = $1 THEN 0 ELSE 1 END LIMIT 1`,
    [reference, organizationId],
  );
  return result.rows[0] ?? null;
}

async function getItems(
  database: WorkerDatabaseClient,
  orderId: string,
): Promise<Item[]> {
  const result = await database.query<Item>(
    `SELECT oli.title, oi.quantity, oi.unit_price
       FROM public.order_item oi
       JOIN public.order_line_item oli ON oli.id = oi.item_id AND oli.deleted_at IS NULL
      WHERE oi.order_id = $1 AND oi.deleted_at IS NULL
      ORDER BY oli.created_at, oli.id
      LIMIT 500`,
    [orderId],
  );
  return result.rows;
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(result)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

export async function handleAdminReceiptRequest(
  request: Request,
  app: WorkerDatabaseClient,
  commerce: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  const method = request.method;
  if (method !== "GET" && method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  const permission = method === "GET" ? "receipts:read" : "receipts:send";
  const claims = await authorize(request, env, permission);
  if (claims instanceof Response) return claims;
  const organizationId = tenant(claims)!;

  if (method === "GET") {
    const reference = new URL(request.url).searchParams.get("order_id")?.trim();
    if (!reference || reference.length > 200)
      return json({ error: "order_id_required" }, 400);
    const order = await resolveOrder(commerce, reference, organizationId);
    if (!order) return json({ error: "not_found" }, 404);
    const result = await app.query<Record<string, unknown>>(
      `SELECT id, order_id, customer_email, receipt_html, sent_at, created_at
         FROM public.digital_receipts
        WHERE medusa_order_id = $1 AND organization_id = $2 LIMIT 1`,
      [order.id, organizationId],
    );
    return result.rows[0]
      ? json({ data: result.rows[0] })
      : json({ error: "not_found" }, 404);
  }

  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255)
    return json({ error: "idempotency_key_required" }, 400);
  let body: { order_id?: unknown; send?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (
    typeof body.order_id !== "string" ||
    !body.order_id.trim() ||
    body.order_id.length > 200 ||
    (body.send !== undefined && typeof body.send !== "boolean")
  )
    return json({ error: "invalid_receipt_request" }, 400);
  const order = await resolveOrder(
    commerce,
    body.order_id.trim(),
    organizationId,
  );
  if (!order) return json({ error: "order_not_found" }, 404);
  const send = body.send === true;
  if (send && !order.email)
    return json({ error: "order_email_unavailable" }, 422);
  if (send && !env.RESEND_API_KEY?.trim())
    return json({ error: "receipt_email_not_configured" }, 503);
  const requestHash = await digest({
    path: new URL(request.url).pathname,
    orderId: order.id,
    send,
    organizationId,
  });
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(app),
    key,
    requestHash,
    async () => {
      const existing = await app.query<Record<string, unknown>>(
        `SELECT id, order_id, customer_email, receipt_html, sent_at, created_at
         FROM public.digital_receipts
        WHERE medusa_order_id = $1 AND organization_id = $2 LIMIT 1`,
        [order.id, organizationId],
      );
      let receipt = existing.rows[0];
      if (!receipt) {
        const html = receiptHtml(
          order,
          await getItems(commerce, order.id),
          env.STORE_NAME?.trim() || "Universal Music Store",
        );
        const inserted = await app.query<Record<string, unknown>>(
          `INSERT INTO public.digital_receipts (order_id, medusa_order_id, organization_id, customer_email, receipt_html)
         VALUES ($1, $1, $2, $3, $4)
         ON CONFLICT (medusa_order_id) DO UPDATE SET organization_id = EXCLUDED.organization_id
           WHERE public.digital_receipts.organization_id = EXCLUDED.organization_id
         RETURNING id, order_id, customer_email, receipt_html, sent_at, created_at`,
          [order.id, organizationId, order.email, html],
        );
        receipt = inserted.rows[0];
        if (!receipt) return json({ error: "receipt_tenant_conflict" }, 409);
      }
      if (send && !receipt.sent_at) {
        const response = await sendResendEmail({
          apiKey: env.RESEND_API_KEY!,
          from:
            env.RESEND_FROM_EMAIL?.trim() ||
            env.RESEND_FROM?.trim() ||
            "noreply@universal-music-store.com",
          to: [order.email ?? ""],
          subject: `Your receipt for Order #${order.display_id}`,
          html: String(receipt.receipt_html),
          idempotencyKey: `receipt:${organizationId}:${order.id}`,
        });
        if (!response.ok)
          return json({ error: "receipt_email_delivery_failed" }, 502);
        const updated = await app.query<Record<string, unknown>>(
          `UPDATE public.digital_receipts SET sent_at = now()
          WHERE id = $1 AND organization_id = $2 AND sent_at IS NULL
          RETURNING id, order_id, customer_email, receipt_html, sent_at, created_at`,
          [receipt.id, organizationId],
        );
        receipt = updated.rows[0] ?? receipt;
      }
      return json({ data: receipt }, existing.rows[0] ? 200 : 201);
    },
  );
  return result.response;
}
