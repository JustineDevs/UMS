import { verifyWorkerBearerToken } from "./auth.ts";
import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string };
type Operation = "release" | "commit" | "attach_medusa" | "close_medusa" | "expire";
type ReservationInput = {
  locationId: string;
  inventoryItemId: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canRead(claims: Awaited<ReturnType<typeof verifyWorkerBearerToken>>): boolean {
  if (!claims) return false;
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "inventory:read" || value === "inventory:write");
}

function reservationJson(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    inventoryItemId: row.inventory_item_id,
    quantity: Number(row.quantity),
    status: row.status,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    medusaReservationId: row.medusa_reservation_id,
    reservedAt: row.reserved_at,
    releasedAt: row.released_at,
    committedAt: row.committed_at,
    expiresAt: row.expires_at,
    expiredAt: row.expired_at,
    reconciliationStatus: row.reconciliation_status,
  };
}

function parseReservationInput(value: unknown): ReservationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["locationId", "inventoryItemId", "quantity", "referenceType", "referenceId", "metadata", "expiresAt"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  if (input.locationId !== undefined && typeof input.locationId !== "string") return null;
  const locationId = typeof input.locationId === "string" ? input.locationId.trim() : "default";
  const inventoryItemId = typeof input.inventoryItemId === "string" ? input.inventoryItemId.trim() : "";
  if (!locationId || locationId.length > 200 || !inventoryItemId || inventoryItemId.length > 200) return null;
  if (!Number.isSafeInteger(input.quantity) || Number(input.quantity) <= 0 || Number(input.quantity) > 1_000_000) return null;
  for (const key of ["referenceType", "referenceId"] as const) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].trim().length > (key === "referenceType" ? 100 : 200))) return null;
  }
  if (input.metadata !== undefined && (!input.metadata || typeof input.metadata !== "object" || Array.isArray(input.metadata))) return null;
  if (input.expiresAt !== undefined && (
    typeof input.expiresAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(input.expiresAt) ||
    Number.isNaN(Date.parse(input.expiresAt)) ||
    Date.parse(input.expiresAt) <= Date.now()
  )) return null;
  return {
    locationId,
    inventoryItemId,
    quantity: Number(input.quantity),
    referenceType: typeof input.referenceType === "string" ? input.referenceType.trim() : undefined,
    referenceId: typeof input.referenceId === "string" ? input.referenceId.trim() : undefined,
    metadata: input.metadata as Record<string, unknown> | undefined,
    expiresAt: input.expiresAt as string | undefined,
  };
}

export async function handleInventoryReservationCollectionRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  commerceDatabase: WorkerDatabaseClient | undefined,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const tenantValue = claims.organization_id ?? claims.org_id;
  if (typeof tenantValue !== "string" || !tenantValue.trim()) return json({ error: "organization_scope_required" }, 403);
  const tenantId = tenantValue.trim();
  if (request.method === "GET") {
    if (!canRead(claims)) return json({ error: "forbidden" }, 403);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? Math.min(200, requestedLimit) : 50;
    const status = url.searchParams.get("status")?.trim();
    const inventoryItemId = url.searchParams.get("inventoryItemId")?.trim();
    if (status && !["active", "released", "committed"].includes(status)) return json({ error: "invalid_reservation_status" }, 400);
    const result = await appDatabase.query<Record<string, unknown>>(
      `SELECT id, tenant_id, location_id, inventory_item_id, quantity, status, reference_type, reference_id,
              medusa_reservation_id, reserved_at, released_at, committed_at, expires_at, expired_at, reconciliation_status
         FROM public.inventory_reservations
        WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR inventory_item_id = $3)
        ORDER BY created_at DESC LIMIT $4`,
      [tenantId, status || null, inventoryItemId || null, limit],
    );
    return json({ data: result.rows.map(reservationJson), organizationId: tenantId });
  }
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  if (!(claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "inventory:write"))) return json({ error: "forbidden" }, 403);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 255) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 64 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return json({ error: "invalid_reservation_payload" }, 400); }
  const input = parseReservationInput(value);
  if (!input) return json({ error: "invalid_reservation_payload" }, 400);
  if (!commerceDatabase) return json({ error: "commerce_database_unavailable" }, 503);
  const requestHash = await sha256(JSON.stringify({ tenantId, ...input }));
  const scopedKey = await sha256(`inventory-reservation:create:${tenantId}:${idempotencyKey}`);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(appDatabase), scopedKey, requestHash, async () => {
    const stock = await commerceDatabase.query<{ location_id: string | null; stocked_quantity: number | string; reserved_quantity: number | string }>(
      `WITH tenant_inventory AS (
         SELECT 1 AS present
          WHERE EXISTS (
            SELECT 1
              FROM public.product_variant_inventory_item pvi
              JOIN public.product_variant v ON v.id = pvi.variant_id AND v.deleted_at IS NULL
              JOIN public.product p ON p.id = v.product_id AND p.deleted_at IS NULL
             WHERE pvi.inventory_item_id = $2 AND pvi.deleted_at IS NULL
               AND p.metadata->>'organization_id' = $3
          )
       )
       SELECT location.id::text AS location_id, COALESCE(SUM(il.stocked_quantity), 0) AS stocked_quantity,
              COALESCE(SUM(il.reserved_quantity), 0) AS reserved_quantity
         FROM tenant_inventory
         LEFT JOIN public.stock_location location ON location.deleted_at IS NULL
              AND location.id::text = CASE WHEN $1 = 'default'
                THEN (SELECT id::text FROM public.stock_location WHERE deleted_at IS NULL ORDER BY created_at, id LIMIT 1)
                ELSE $1 END
         LEFT JOIN public.inventory_level il ON il.location_id = location.id
              AND il.inventory_item_id = $2 AND il.deleted_at IS NULL
        GROUP BY location.id LIMIT 1`,
      [input.locationId, input.inventoryItemId, tenantId],
    );
    const stockRow = stock.rows[0];
    if (!stockRow) return json({ error: "inventory_item_not_found" }, 404);
    if (!stockRow.location_id) return json({ error: "no_active_stock_location" }, 409);
    const availableQuantity = Math.max(0, Number(stockRow.stocked_quantity) - Number(stockRow.reserved_quantity));
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString();
    try {
      const reservation = await withWorkerTransaction(appDatabase, async (transaction) => {
        const inserted = await transaction.query<Record<string, unknown>>(
          "SELECT (public.inventory_reservation_lifecycle('reserve', $1, $2, NULL, $3, $4, $5, $6, NULL, $7, $8, $9::jsonb)).*",
          [tenantId, idempotencyKey, stockRow.location_id, input.inventoryItemId, input.quantity, availableQuantity, input.referenceType ?? null, input.referenceId ?? null, JSON.stringify(input.metadata ?? {})],
        );
        const row = inserted.rows[0];
        if (!row) throw new Error("inventory_reservation_create_failed");
        const expiring = await transaction.query<Record<string, unknown>>(
          "SELECT (public.inventory_reservation_set_expiry($1, $2::uuid, $3::timestamptz)).*",
          [tenantId, row.id, expiresAt],
        );
        const finalRow = expiring.rows[0];
        if (!finalRow) throw new Error("inventory_reservation_expiry_failed");
        await transaction.query(
          "INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)",
          ["inventory.reservation.create", `reservation:${String(finalRow.id)}`, JSON.stringify({ organization_id: tenantId, actor_subject: claims.sub, inventory_item_id: input.inventoryItemId, quantity: input.quantity })],
        );
        return finalRow;
      });
      return json({ data: reservationJson(reservation) }, 201);
    } catch {
      return json({ error: "inventory_reservation_failed", code: "INVENTORY_RESERVATION_FAILED" }, 503);
    }
  })).response;
}

export async function handleInventoryReservationMutationRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: Env,
  reservationId: string,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  if (!(claims.role === "owner" || claims.role === "admin" || permissions.some((permission) => permission === "*" || permission === "inventory:write"))) {
    return json({ error: "forbidden" }, 403);
  }
  const tenantId = claims.organization_id ?? claims.org_id;
  if (typeof tenantId !== "string" || !tenantId.trim()) return json({ error: "organization_scope_required" }, 403);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reservationId)) {
    return json({ error: "invalid_reservation_id" }, 400);
  }
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    return json({ error: "idempotency_key_required" }, 400);
  }
  const raw = await request.text();
  if (raw.length > 16 * 1024) return json({ error: "payload_too_large" }, 413);
  let input: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "invalid_reservation_operation" }, 400);
    input = value as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_reservation_operation" }, 400);
  }
  const allowed = new Set(["operation", "medusaReservationId"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return json({ error: "invalid_reservation_operation" }, 400);
  const operation = input.operation as Operation;
  if (!["release", "commit", "attach_medusa", "close_medusa", "expire"].includes(operation)) {
    return json({ error: "invalid_reservation_operation" }, 400);
  }
  const externalReservationId = input.medusaReservationId;
  if (operation === "attach_medusa" && (typeof externalReservationId !== "string" || !externalReservationId.trim() || externalReservationId.length > 200)) {
    return json({ error: "medusa_reservation_id_required" }, 400);
  }
  if (operation !== "attach_medusa" && externalReservationId !== undefined) return json({ error: "invalid_reservation_operation" }, 400);

  const normalized = { tenantId: tenantId.trim(), reservationId, operation, externalReservationId: operation === "attach_medusa" ? (externalReservationId as string).trim() : null };
  const requestHash = await sha256(JSON.stringify(normalized));
  const scopedIdempotencyKey = await sha256(`inventory-reservation:${normalized.tenantId}:${idempotencyKey}`);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    scopedIdempotencyKey,
    requestHash,
    async () => {
      try {
        const query = operation === "expire"
          ? "SELECT (public.inventory_reservation_expire($1, $2::uuid, $3)).*"
          : "SELECT (public.inventory_reservation_lifecycle($1, $2, $3, $4::uuid, NULL, NULL, NULL, NULL, $5, NULL, NULL, '{}'::jsonb)).*";
        const values = operation === "expire"
          ? [normalized.tenantId, reservationId, idempotencyKey]
          : [operation, normalized.tenantId, idempotencyKey, reservationId, normalized.externalReservationId];
        const mutation = await database.query(query, values);
        if (!mutation.rows[0]) return json({ error: "reservation_not_found" }, 404);
        return json({ data: reservationJson(mutation.rows[0]) });
      } catch {
        return json({ error: "inventory_reservation_operation_failed" }, 409);
      }
    },
  );
  return result.response;
}
