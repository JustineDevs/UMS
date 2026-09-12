import type { WorkerAuthClaims } from "./auth.ts";
import { verifyWorkerBearerToken } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import {
  withWorkerDatabase,
  withWorkerTransaction,
  type WorkerDatabaseClient,
  type WorkerDatabaseEnv,
} from "./database.ts";

export type OrderMutationEnv = WorkerDatabaseEnv & {
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
  /** Test-only seam. Production uses the named APP/MEDUSA bindings. */
  databaseFactory?: (role: "app" | "medusa") => WorkerDatabaseClient;
};

type OrderMutationRow = {
  id: string;
  customer_id: string | null;
  email: string | null;
  status: string | null;
};

type ReturnLineRow = {
  id: string;
  quantity: number | string | null;
  return_requested_quantity: number | string | null;
  return_received_quantity: number | string | null;
  return_dismissed_quantity: number | string | null;
  written_off_quantity: number | string | null;
};

type ReturnLine = {
  item_id: string;
  quantity: number;
  reason_id?: string;
  note?: string;
};

const RETURNABLE_STATUSES = new Set([
  "completed",
  "partially_fulfilled",
  "fulfilled",
  "shipped",
  "delivered",
]);
const CANCELLABLE_STATUSES = new Set([
  "pending",
  "pending_payment",
  "requires_action",
]);
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_BODY_BYTES = 32 * 1024;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function claimsEmail(claims: WorkerAuthClaims): string | null {
  const value = claims.email;
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ? email
    : null;
}

function auth(request: Request, env: OrderMutationEnv): Promise<WorkerAuthClaims | null> {
  return verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
}

async function withRole<T>(
  env: OrderMutationEnv,
  role: "app" | "medusa",
  operation: (database: WorkerDatabaseClient) => Promise<T>,
): Promise<T> {
  if (!env.databaseFactory) return withWorkerDatabase(env, operation, role);
  const database = env.databaseFactory(role);
  try {
    return await operation(database);
  } finally {
    await database.end();
  }
}

function integer(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(result) ? Math.max(0, result) : 0;
}

async function requestHash(request: Request, discriminator: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${request.method}:${new URL(request.url).pathname}:${discriminator}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ownsOrder(row: OrderMutationRow, claims: WorkerAuthClaims, email: string): boolean {
  return row.customer_id === claims.sub || row.email?.trim().toLowerCase() === email;
}

async function readOrder(
  database: WorkerDatabaseClient,
  orderId: string,
): Promise<OrderMutationRow | null> {
  const result = await database.query<OrderMutationRow>(
    `SELECT id, customer_id, email, status
       FROM public."order"
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [orderId],
  );
  return result.rows[0] ?? null;
}

export async function handleOrderCancellationRequest(
  request: Request,
  env: OrderMutationEnv,
  orderId: string,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!RESOURCE_ID.test(orderId)) return json({ error: "not_found" }, 404);
  const claims = await auth(request, env);
  const email = claims ? claimsEmail(claims) : null;
  if (!claims || !email) return json({ error: "unauthorized" }, 401);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const hash = await requestHash(request, `${claims.sub}:${email}:${orderId}`);

  return withRole(env, "app", async (appDatabase) => {
    const result = await executeIdempotently(
      new HyperdriveIdempotencyStore(appDatabase),
      idempotencyKey,
      hash,
      () => withRole(env, "medusa", async (database) => {
        const order = await readOrder(database, orderId);
        if (!order || !ownsOrder(order, claims, email)) return json({ error: "not_found" }, 404);
        if (order.status === "canceled" || order.status === "cancelled") {
          return json({ ok: true, already_canceled: true });
        }
        if (!CANCELLABLE_STATUSES.has(order.status ?? "")) {
          return json({ error: "order_not_cancellable" }, 422);
        }
        const updated = await withWorkerTransaction(database, (transaction) =>
          transaction.query<OrderMutationRow>(
            `UPDATE public."order"
                SET status = 'canceled', canceled_at = now(), updated_at = now()
              WHERE id = $1 AND deleted_at IS NULL
                AND (customer_id = $2 OR lower(email) = $3)
                AND status IN ('pending', 'pending_payment', 'requires_action')
              RETURNING id, customer_id, email, status`,
            [orderId, claims.sub, email],
          ),
        );
        if (updated.rowCount !== 1) return json({ error: "order_state_changed" }, 409);
        return json({ ok: true, order: updated.rows[0] });
      }),
    );
    return result.response;
  });
}

function parseReturnBody(value: unknown):
  | { ok: true; orderId: string; items: ReturnLine[]; note: string | null }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const input = value as Record<string, unknown>;
  const orderId = typeof input.orderId === "string" ? input.orderId.trim() : "";
  const note = input.note === undefined ? null : typeof input.note === "string" ? input.note.trim() : null;
  if (!RESOURCE_ID.test(orderId) || (note !== null && note.length > 1000)) return { ok: false };
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) return { ok: false };
  const seen = new Set<string>();
  const items: ReturnLine[] = [];
  for (const raw of input.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false };
    const item = raw as Record<string, unknown>;
    const itemId = typeof item.item_id === "string" ? item.item_id.trim() : "";
    const quantity = Number(item.quantity);
    const reasonId = item.reason_id === undefined ? undefined : typeof item.reason_id === "string" ? item.reason_id.trim() : "";
    const lineNote = item.note === undefined ? undefined : typeof item.note === "string" ? item.note.trim() : "";
    if (!RESOURCE_ID.test(itemId) || seen.has(itemId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return { ok: false };
    if (reasonId !== undefined && !RESOURCE_ID.test(reasonId)) return { ok: false };
    if (lineNote !== undefined && lineNote.length > 500) return { ok: false };
    seen.add(itemId);
    items.push({ item_id: itemId, quantity, ...(reasonId ? { reason_id: reasonId } : {}), ...(lineNote ? { note: lineNote } : {}) });
  }
  return { ok: true, orderId, items, note };
}

async function recordReturnAudit(
  env: OrderMutationEnv,
  input: { orderId: string; email: string; items: ReturnLine[]; note: string | null },
): Promise<boolean> {
  try {
    return await withRole(env, "app", async (database) => {
      return withWorkerTransaction(database, async (transaction) => {
        const job = await transaction.query<{ id: string }>(
          `INSERT INTO public.background_jobs (job_type, payload, status, progress, created_by)
           VALUES ('return_request_review', $1::jsonb, 'queued', 0, 'worker-native')
           RETURNING id`,
          [JSON.stringify({ order_id: input.orderId, email: input.email })],
        );
        const audit = await transaction.query<{ id: string }>(
          `INSERT INTO public.customer_return_request_audit
             (medusa_order_id, customer_email, items, note, medusa_response, staff_review_job_id)
           VALUES ($1, $2, $3::jsonb, $4, '{}'::jsonb, $5)
           RETURNING id`,
          [input.orderId, input.email, JSON.stringify(input.items), input.note, job.rows[0]?.id ?? null],
        );
        return job.rowCount === 1 && audit.rowCount === 1;
      });
    });
  } catch {
    return false;
  }
}

export async function handleOrderReturnRequest(
  request: Request,
  env: OrderMutationEnv,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await auth(request, env);
  const email = claims ? claimsEmail(claims) : null;
  if (!claims || !email) return json({ error: "unauthorized" }, 401);
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413);
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = parseReturnBody(body);
  if (!parsed.ok) return json({ error: "invalid_return_payload" }, 400);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const hash = await requestHash(request, `${claims.sub}:${email}:${JSON.stringify(parsed)}`);

  return withRole(env, "app", async (appDatabase) => {
    const result = await executeIdempotently(
      new HyperdriveIdempotencyStore(appDatabase),
      idempotencyKey,
      hash,
      async () => {
        const mutation = await withRole(env, "medusa", async (database) => {
          const order = await readOrder(database, parsed.orderId);
          if (!order) return { response: json({ error: "order_not_found" }, 404), audit: null };
          if (!ownsOrder(order, claims, email)) return { response: json({ error: "forbidden" }, 403), audit: null };
          const status = order.status?.trim().toLowerCase() ?? "";
          if (!RETURNABLE_STATUSES.has(status)) return { response: json({ error: "return_not_eligible", code: "RETURN_NOT_ELIGIBLE" }, 409), audit: null };

          const lineIds = parsed.items.map((item) => item.item_id);
          const lines = await database.query<ReturnLineRow>(
            `SELECT id, quantity, return_requested_quantity, return_received_quantity,
              return_dismissed_quantity, written_off_quantity
         FROM public.order_item
        WHERE order_id = $1 AND id = ANY($2::text[]) AND deleted_at IS NULL
        FOR UPDATE`,
            [parsed.orderId, lineIds],
          );
          const byId = new Map(lines.rows.map((line) => [line.id, line]));
          for (const item of parsed.items) {
            const line = byId.get(item.item_id);
            const available = line
              ? integer(line.quantity) - integer(line.return_requested_quantity) - integer(line.return_received_quantity) - integer(line.return_dismissed_quantity) - integer(line.written_off_quantity)
              : -1;
            if (!line) return { response: json({ error: "return_item_not_found", code: "RETURN_LINES_INVALID" }, 409), audit: null };
            if (item.quantity > Math.max(0, available)) return { response: json({ error: "return_quantity_exceeds_available", code: "RETURN_LINES_INVALID" }, 409), audit: null };
          }

          await withWorkerTransaction(database, async (transaction) => {
            for (const item of parsed.items) {
              const updated = await transaction.query(
                `UPDATE public.order_item
              SET return_requested_quantity = COALESCE(return_requested_quantity, 0) + $3,
                  version = COALESCE(version, 0) + 1
            WHERE order_id = $1 AND id = $2 AND deleted_at IS NULL
              AND (COALESCE(quantity, 0) - COALESCE(return_requested_quantity, 0)
                   - COALESCE(return_received_quantity, 0)
                   - COALESCE(return_dismissed_quantity, 0)
                   - COALESCE(written_off_quantity, 0)) >= $3`,
                [parsed.orderId, item.item_id, item.quantity],
              );
              if (updated.rowCount !== 1) throw new Error("return_state_changed");
            }
          });
          return { response: json({ ok: true, order_id: parsed.orderId, items: parsed.items }), audit: parsed };
        });

        if (!mutation.audit) return mutation.response;
        const auditRecorded = await recordReturnAudit(env, {
          orderId: mutation.audit.orderId,
          email,
          items: mutation.audit.items,
          note: mutation.audit.note,
        });
        return json(
          { ok: true, order_id: mutation.audit.orderId, items: mutation.audit.items, auditStatus: auditRecorded ? "recorded" : "pending" },
          auditRecorded ? 200 : 202,
        );
      },
    );
    return result.response;
  });
}
