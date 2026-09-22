import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { createCommerceJob, enqueueCommerceJob, type WorkerQueue } from "./queue.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string; COMMERCE_QUEUE?: WorkerQueue };
type FulfillmentInput = {
  orderIds: string[];
  trackingNumber?: string;
  carrierId?: string;
  notifyCustomer: boolean;
};
type FulfillmentResult = {
  orderId: string;
  ok: boolean;
  error?: string;
  skipped?: boolean;
  fulfillment_status?: string;
  displayId?: number | string | null;
  email?: string | null;
  shouldMirror?: boolean;
  notificationAttemptId?: string;
};

type FulfillableOrderItem = {
  id: string;
  item_id: string;
  quantity: number | string;
  fulfilled_quantity: number | string | null;
  title: string;
  variant_title: string | null;
  variant_sku: string | null;
  variant_barcode: string | null;
  variant_id: string | null;
  requires_shipping: boolean;
  manage_inventory: boolean | null;
};

function commerceId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function rawQuantity(value: number): string {
  return JSON.stringify({ value: String(value), precision: 20 });
}

const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_FIELDS = new Set(["orderIds", "trackingNumber", "carrierId", "notifyCustomer"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function canWrite(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((permission) => permission === "*" || permission === "orders:fulfill");
}

function organization(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readInput(request: Request): Promise<FulfillmentInput | Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

  const reader = request.body?.getReader();
  if (!reader) return json({ error: "invalid_json" }, 400);

  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: "payload_too_large" }, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload" }, 400);

  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_FIELDS.has(key))) return json({ error: "unknown_payload_field" }, 400);
  if (!Array.isArray(record.orderIds) || record.orderIds.length < 1 || record.orderIds.length > 100 || record.orderIds.some((value) => typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))) {
    return json({ error: "invalid_order_ids" }, 400);
  }
  const orderIds = record.orderIds as string[];
  if (new Set(orderIds).size !== orderIds.length) return json({ error: "duplicate_order_ids" }, 400);

  for (const [field, value, maxLength] of [["trackingNumber", record.trackingNumber, 120], ["carrierId", record.carrierId, 80]] as const) {
    if (value !== undefined && (typeof value !== "string" || value.trim().length > maxLength || /[\u0000-\u001f\u007f]/.test(value))) {
      return json({ error: field === "trackingNumber" ? "invalid_tracking_number" : "invalid_carrier_id" }, 400);
    }
  }
  if (record.notifyCustomer !== undefined && typeof record.notifyCustomer !== "boolean") return json({ error: "invalid_notify_customer" }, 400);

  return {
    orderIds,
    trackingNumber: typeof record.trackingNumber === "string" && record.trackingNumber.trim() ? record.trackingNumber.trim() : undefined,
    carrierId: typeof record.carrierId === "string" && record.carrierId.trim() ? record.carrierId.trim() : undefined,
    notifyCustomer: record.notifyCustomer !== false,
  };
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

async function ensureFulfillmentNotification(
  app: WorkerDatabaseClient,
  org: string,
  orderId: string,
  result: FulfillmentResult,
  input: FulfillmentInput,
): Promise<string | null> {
  if (!input.notifyCustomer || !result.email) return null;
  if (result.email.length > 320 || !EMAIL_RE.test(result.email)) throw new Error("order_customer_email_invalid");
  const idempotencyKey = `order-fulfillment:${org}:${orderId}`;
  const attempt = await withWorkerTransaction(app, async (tx) => {
    const inserted = await tx.query<{ id: string; status: string }>(
      `INSERT INTO public.public_delivery_attempts
         (organization_id,delivery_kind,aggregate_id,recipient,provider,idempotency_key,status)
       VALUES ($1,'order_fulfillment',$2,$3,'resend',$4,'queued')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id,status`,
      [org, orderId, result.email, idempotencyKey],
    );
    if (inserted.rows[0]) return inserted.rows[0];
    const existing = await tx.query<{ id: string; status: string }>(
      `SELECT id,status FROM public.public_delivery_attempts
        WHERE idempotency_key=$1 AND organization_id=$2 AND aggregate_id=$3 AND recipient=$4
        FOR UPDATE`,
      [idempotencyKey, org, orderId, result.email],
    );
    return existing.rows[0] ?? null;
  });

  if (!attempt || !["queued", "retry"].includes(attempt.status)) return null;
  return attempt.id;
}

export async function handleBulkFulfillmentRequest(
  request: Request,
  commerce: WorkerDatabaseClient,
  app: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !canWrite(claims)) return json({ error: "forbidden" }, 403);
  const org = organization(claims);
  if (!org) return json({ error: "organization_scope_required" }, 403);

  const requestKey = request.headers.get("Idempotency-Key")?.trim();
  if (!requestKey || requestKey.length > 255 || /[\u0000-\u001f\u007f]/.test(requestKey)) return json({ error: "idempotency_key_required" }, 400);
  const input = await readInput(request);
  if (input instanceof Response) return input;
  if (input.notifyCustomer && !env.COMMERCE_QUEUE) return json({ error: "notification_queue_unavailable" }, 503);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ org, ...input })));
  const hash = hex(digest);
  const tenantKey = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${org}\0${requestKey}`)));

  const outcome = await executeIdempotently(new HyperdriveIdempotencyStore(app), `bulk-fulfillment:${tenantKey}`, hash, async () => {
    const results: FulfillmentResult[] = [];
    for (const orderId of input.orderIds) {
      const result = await withWorkerTransaction(commerce, async (tx): Promise<FulfillmentResult> => {
        const order = await tx.query<{ id: string; display_id: number | string | null; email: string | null; status: string; fulfillment_status: string | null; version: number; shipping_address_id: string | null }>(
          `SELECT id,display_id,email,status,fulfillment_status,version,shipping_address_id
             FROM public."order"
            WHERE id=$1 AND deleted_at IS NULL
              AND COALESCE(metadata->>'organization_id', metadata->>'store_id')=$2
            FOR UPDATE`,
          [orderId, org],
        );
        const row = order.rows[0];
        if (!row) return { orderId, ok: false, error: "order_not_found" };
        if (row.status === "canceled") return { orderId, ok: false, error: "order_cancelled" };
        if (!Number.isSafeInteger(row.version) || row.version < 1 || row.version >= 2_147_483_647) {
          return { orderId, ok: false, error: "invalid_order_version" };
        }

        const email = row.email?.trim() || null;
        if ((input.notifyCustomer || input.trackingNumber) && !email) return { orderId, ok: false, error: "order_customer_email_missing" };

        if (["fulfilled", "shipped", "delivered"].includes(row.fulfillment_status ?? "")) {
          return { orderId, ok: true, skipped: true, fulfillment_status: row.fulfillment_status ?? undefined, displayId: row.display_id, email, shouldMirror: true };
        }

        const itemRows = await tx.query<FulfillableOrderItem>(
          `SELECT oi.id,oi.item_id,oi.quantity,oi.fulfilled_quantity,
                  li.title,li.variant_title,li.variant_sku,li.variant_barcode,
                  li.variant_id,li.requires_shipping,pv.manage_inventory
             FROM public.order_item oi
             JOIN public.order_line_item li ON li.id=oi.item_id
             LEFT JOIN public.product_variant pv ON pv.id=li.variant_id AND pv.deleted_at IS NULL
            WHERE oi.order_id=$1 AND oi.version=$2
              AND oi.deleted_at IS NULL AND li.deleted_at IS NULL
            ORDER BY oi.item_id
            FOR UPDATE OF oi`,
          [orderId, row.version],
        );
        const remainingItems: Array<FulfillableOrderItem & { quantity: number }> = [];
        for (const item of itemRows.rows) {
          const quantity = Number(item.quantity);
          const fulfilled = Number(item.fulfilled_quantity ?? 0);
          if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(fulfilled) || fulfilled < 0 || fulfilled > quantity) {
            return { orderId, ok: false, error: "invalid_fulfillment_item_state" };
          }
          if (quantity > fulfilled) remainingItems.push({ ...item, quantity: quantity - fulfilled });
        }
        if (remainingItems.length === 0) {
          return { orderId, ok: true, skipped: true, error: "no_items_to_fulfill", fulfillment_status: row.fulfillment_status ?? undefined, displayId: row.display_id, email, shouldMirror: false };
        }

        const shipping = await tx.query<{ shipping_option_id: string; provider_id: string | null; location_id: string | null; data: unknown }>(
          `SELECT so.id AS shipping_option_id,so.provider_id,lfs.stock_location_id AS location_id,osm.data
             FROM public.order_shipping os
             JOIN public.order_shipping_method osm ON osm.id=os.shipping_method_id
             JOIN public.shipping_option so ON so.id=osm.shipping_option_id AND so.deleted_at IS NULL
             JOIN public.service_zone sz ON sz.id=so.service_zone_id AND sz.deleted_at IS NULL
             LEFT JOIN public.location_fulfillment_set lfs ON lfs.fulfillment_set_id=sz.fulfillment_set_id
            WHERE os.order_id=$1 AND os.version=$2
              AND os.deleted_at IS NULL AND osm.shipping_option_id IS NOT NULL
            ORDER BY os.created_at,so.id
            LIMIT 1
            FOR SHARE OF so`,
          [orderId, row.version],
        );
        const shippingRow = shipping.rows[0];
        if (!shippingRow) return { orderId, ok: false, error: "order_shipping_option_missing" };
        if (!shippingRow.location_id) return { orderId, ok: false, error: "shipping_option_stock_location_missing" };

        const reservationRows = await tx.query<{ id: string; line_item_id: string; inventory_item_id: string; location_id: string; quantity: number | string; required_quantity: number | string | null; title: string | null; sku: string | null }>(
          `SELECT ri.id,ri.line_item_id,ri.inventory_item_id,ri.location_id,ri.quantity,
                  pvi.required_quantity,ii.title,ii.sku
             FROM public.reservation_item ri
             JOIN public.product_variant_inventory_item pvi
               ON pvi.inventory_item_id=ri.inventory_item_id
             JOIN public.order_line_item li ON li.id=ri.line_item_id
             JOIN public.product_variant pv ON pv.id=li.variant_id AND pv.id=pvi.variant_id
             LEFT JOIN public.inventory_item ii ON ii.id=ri.inventory_item_id AND ii.deleted_at IS NULL
            WHERE ri.line_item_id=ANY($1::text[]) AND ri.deleted_at IS NULL
            ORDER BY ri.line_item_id,ri.inventory_item_id,ri.id
            FOR UPDATE OF ri`,
          [remainingItems.map((item) => item.item_id)],
        );
        const reservationsByLine = new Map<string, typeof reservationRows.rows>();
        for (const reservation of reservationRows.rows) {
          const list = reservationsByLine.get(reservation.line_item_id) ?? [];
          list.push(reservation);
          reservationsByLine.set(reservation.line_item_id, list);
        }
        const fulfillmentItems: Array<{ id: string; lineItemId: string; inventoryItemId: string | null; quantity: number; title: string; sku: string; barcode: string }> = [];
        for (const item of remainingItems) {
          const reservations = reservationsByLine.get(item.item_id) ?? [];
          if (item.requires_shipping && item.manage_inventory !== false && reservations.length === 0) {
            return { orderId, ok: false, error: "inventory_reservation_missing" };
          }
          if (!reservations.length) {
            fulfillmentItems.push({ id: commerceId("fulitem"), lineItemId: item.item_id, inventoryItemId: null, quantity: item.quantity, title: item.variant_title || item.title, sku: item.variant_sku || "", barcode: item.variant_barcode || "" });
            continue;
          }
          for (const reservation of reservations) {
            const requiredQuantity = Number(reservation.required_quantity ?? 1);
            const reserved = Number(reservation.quantity);
            const consumed = item.quantity * requiredQuantity;
            if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0 || !Number.isSafeInteger(reserved) || reserved < consumed) {
              return { orderId, ok: false, error: "inventory_reservation_insufficient" };
            }
            const level = await tx.query(
              `UPDATE public.inventory_level
                  SET stocked_quantity=stocked_quantity-$3,
                      reserved_quantity=reserved_quantity-$3,
                      updated_at=now()
                WHERE inventory_item_id=$1 AND location_id=$2 AND deleted_at IS NULL
                  AND stocked_quantity >= $3 AND reserved_quantity >= $3`,
              [reservation.inventory_item_id, reservation.location_id, consumed],
            );
            if (level.rowCount !== 1) throw new Error("inventory_level_changed_during_fulfillment");
            const remainingReservation = reserved - consumed;
            if (remainingReservation === 0) {
              const removed = await tx.query(`UPDATE public.reservation_item SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [reservation.id]);
              if (removed.rowCount !== 1) throw new Error("inventory_reservation_changed_during_fulfillment");
            } else {
              const adjusted = await tx.query(`UPDATE public.reservation_item SET quantity=$2,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`, [reservation.id, remainingReservation]);
              if (adjusted.rowCount !== 1) throw new Error("inventory_reservation_changed_during_fulfillment");
            }
            fulfillmentItems.push({ id: commerceId("fulitem"), lineItemId: item.item_id, inventoryItemId: reservation.inventory_item_id, quantity: consumed, title: reservation.title || item.variant_title || item.title, sku: reservation.sku || item.variant_sku || "", barcode: item.variant_barcode || "" });
          }
        }

        const addressId = commerceId("fuladdr");
        await tx.query(
          `INSERT INTO public.fulfillment_address
             (id,company,first_name,last_name,address_1,address_2,city,country_code,province,postal_code,phone,metadata)
           SELECT $2,company,first_name,last_name,address_1,address_2,city,country_code,province,postal_code,phone,metadata
             FROM public.order_address WHERE id=$1
           UNION ALL
           SELECT $2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL
            WHERE NOT EXISTS (SELECT 1 FROM public.order_address WHERE id=$1)`,
          [row.shipping_address_id, addressId],
        );
        const fulfillmentId = commerceId("ful");
        await tx.query(
          `INSERT INTO public.fulfillment
             (id,location_id,packed_at,data,provider_id,shipping_option_id,delivery_address_id)
           VALUES ($1,$2,now(),$3::jsonb,$4,$5,$6)`,
          [fulfillmentId, shippingRow.location_id, JSON.stringify(shippingRow.data ?? {}), shippingRow.provider_id, shippingRow.shipping_option_id, addressId],
        );
        for (const item of fulfillmentItems) {
          await tx.query(
            `INSERT INTO public.fulfillment_item
               (id,title,sku,barcode,quantity,raw_quantity,line_item_id,inventory_item_id,fulfillment_id)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
            [item.id, item.title, item.sku, item.barcode, item.quantity, rawQuantity(item.quantity), item.lineItemId, item.inventoryItemId, fulfillmentId],
          );
        }
        await tx.query(
          `INSERT INTO public.order_fulfillment (id,order_id,fulfillment_id) VALUES ($1,$2,$3)`,
          [commerceId("ordful"), orderId, fulfillmentId],
        );

        const nextVersion = Number(row.version) + 1;
        const orderChangeId = commerceId("ordch");
        await tx.query(
          `INSERT INTO public.order_change
             (id,order_id,version,description,status,created_by,confirmed_by,confirmed_at)
           VALUES ($1,$2,$3,'Order fulfillment','confirmed',$4,$4,now())`,
          [orderChangeId, orderId, nextVersion, typeof claims.sub === "string" ? claims.sub : null],
        );
        const fulfilledQuantityByLine = new Map(remainingItems.map((item) => [item.item_id, item.quantity]));
        for (const item of itemRows.rows) {
          const fulfillmentQuantity = fulfilledQuantityByLine.get(item.item_id) ?? 0;
          await tx.query(
            `INSERT INTO public.order_change_action
               (id,order_id,version,order_change_id,reference,reference_id,action,details,applied)
             SELECT $1,$2,$3,$4,'fulfillment',$5,'FULFILL_ITEM',$6::jsonb,true
              WHERE $7::numeric > 0`,
            [commerceId("ordchact"), orderId, nextVersion, orderChangeId, fulfillmentId, JSON.stringify({ reference_id: item.item_id, quantity: fulfillmentQuantity, metadata: null }), fulfillmentQuantity],
          );
          const versioned = await tx.query(
            `INSERT INTO public.order_item
               (id,order_id,version,item_id,quantity,raw_quantity,fulfilled_quantity,raw_fulfilled_quantity,
                shipped_quantity,raw_shipped_quantity,delivered_quantity,raw_delivered_quantity,
                return_requested_quantity,raw_return_requested_quantity,return_received_quantity,raw_return_received_quantity,
                return_dismissed_quantity,raw_return_dismissed_quantity,written_off_quantity,raw_written_off_quantity,metadata)
             SELECT $3,order_id,$4,item_id,quantity,raw_quantity,fulfilled_quantity+$5,
                    CASE WHEN $5::numeric = 0 THEN raw_fulfilled_quantity ELSE $6::jsonb END,
                    shipped_quantity,raw_shipped_quantity,delivered_quantity,raw_delivered_quantity,
                    return_requested_quantity,raw_return_requested_quantity,return_received_quantity,raw_return_received_quantity,
                    return_dismissed_quantity,raw_return_dismissed_quantity,written_off_quantity,raw_written_off_quantity,metadata
               FROM public.order_item
              WHERE order_id=$1 AND item_id=$2 AND version=$7 AND deleted_at IS NULL`,
            [orderId, item.item_id, commerceId("orditem"), nextVersion, fulfillmentQuantity, rawQuantity(Number(item.fulfilled_quantity ?? 0) + fulfillmentQuantity), row.version],
          );
          if (versioned.rowCount !== 1) throw new Error("fulfillment_item_state_changed");
        }
        const summary = await tx.query(
          `INSERT INTO public.order_summary (id,order_id,version,totals)
           SELECT $3,order_id,$2,totals FROM public.order_summary
            WHERE order_id=$1 AND version=$4 AND deleted_at IS NULL`,
          [orderId, nextVersion, commerceId("ordsum"), row.version],
        );
        if (summary.rowCount !== 1) throw new Error("order_summary_version_missing");
        await tx.query(
          `UPDATE public.order_change SET updated_at=now() WHERE id=$1 AND status='confirmed'`,
          [orderChangeId],
        );

        const updated = await tx.query<{ id: string; fulfillment_status: string }>(
          `UPDATE public."order"
              SET fulfillment_status='fulfilled', fulfilled_at=COALESCE(fulfilled_at,now()), version=$2, updated_at=now()
            WHERE id=$1 AND version=$3 AND deleted_at IS NULL
            RETURNING id,fulfillment_status`,
          [orderId, nextVersion, row.version],
        );
        if (updated.rowCount !== 1) throw new Error("order_state_changed");
        return { orderId, ok: true, fulfillment_status: updated.rows[0].fulfillment_status, displayId: row.display_id, email, shouldMirror: true };
      });

      if (result.ok && result.shouldMirror && result.fulfillment_status) {
        await withWorkerTransaction(app, async (tx) => {
          if (result.shouldMirror && result.email && input.trackingNumber) {
            await tx.query(
              `INSERT INTO public.delivery_logistics_shipments
                 (organization_id,order_id,order_display_id,customer_email,courier_slug,tracking_status,status,metadata,created_by_email,updated_by_email,provider_shipment_id,tracking_url,idempotency_key)
               VALUES ($1,$2,$3,$4,$5,'assigned','assigned',$6::jsonb,$7,$7,NULL,NULL,$8)
               ON CONFLICT (organization_id,order_id) DO NOTHING`,
              [org, orderId, String(result.displayId ?? orderId), result.email, input.carrierId ?? null, JSON.stringify({ source: "worker_bulk_fulfillment", ...(input.trackingNumber ? { tracking_number: input.trackingNumber } : {}) }), typeof claims.email === "string" ? claims.email.trim().slice(0, 320) || null : null, `${tenantKey}:${orderId}`],
            );
          }
          await tx.query(
            `INSERT INTO public.audit_logs (action,resource,details)
             SELECT $1,$2,$3::jsonb
             WHERE NOT EXISTS (
               SELECT 1 FROM public.audit_logs
                WHERE action=$1 AND resource=$2 AND details->>'idempotency_key'=$4
             )`,
            ["order.bulk_fulfill", `order:${orderId}`, JSON.stringify({ organization_id: org, actor_subject: claims.sub, actor_email: claims.email, idempotency_key: `${tenantKey}:${orderId}`, shipment_repaired: result.skipped === true, shipment_created: Boolean(result.shouldMirror) }), `${tenantKey}:${orderId}`],
          );
        });
      }

      if (result.ok && result.fulfillment_status && input.notifyCustomer) {
        const attemptId = await ensureFulfillmentNotification(app, org, orderId, result, input);
        if (attemptId && env.COMMERCE_QUEUE) {
          const tracking = input.trackingNumber
            ? `<p>Tracking number: <strong>${escapeHtml(input.trackingNumber)}</strong></p>`
            : "";
          await enqueueCommerceJob(env.COMMERCE_QUEUE, createCommerceJob("notification-delivery", {
            attemptId,
            recipient: result.email!,
            subject: `Your order #${escapeHtml(String(result.displayId ?? orderId))} has been fulfilled`,
            html: `<p>Your order #${escapeHtml(String(result.displayId ?? orderId))} has been fulfilled.</p>${tracking}`,
          }));
        }
      }
      const { shouldMirror: _shouldMirror, ...responseResult } = result;
      results.push(responseResult);
    }

    const failed = results.filter((result) => !result.ok).length;
    return json({ total: input.orderIds.length, succeeded: results.filter((result) => result.ok && !result.skipped).length, skipped: results.filter((result) => result.skipped).length, failed, results });
  });

  return outcome.response;
}
