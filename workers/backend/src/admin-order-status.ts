import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string };
type Status = "pending" | "paid" | "processing" | "packed" | "shipped" | "delivered" | "cancelled" | "returned" | "refunded" | "failed";
type OrderState = { id: string; metadata: Record<string, unknown> };

const STATUSES = new Set<Status>(["pending", "paid", "processing", "packed", "shipped", "delivered", "cancelled", "returned", "refunded", "failed"]);

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function canWrite(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((item) => item === "*" || item === "orders:write");
}

export async function handleAdminOrderStatusRequest(
  request: Request,
  commerce: WorkerDatabaseClient,
  app: WorkerDatabaseClient,
  env: Env,
  orderId: string,
): Promise<Response> {
  if (request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !canWrite(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = claims.organization_id ?? claims.org_id;
  if (typeof organizationId !== "string" || !organizationId.trim()) return json({ error: "organization_scope_required" }, 403);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) return json({ error: "idempotency_key_required" }, 400);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_status" }, 400);
  const status = (body as Record<string, unknown>).status;
  if (typeof status !== "string" || !STATUSES.has(status as Status)) return json({ error: "invalid_status" }, 400);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, orderId, status })));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(app), idempotencyKey, hash, async () => {
    let previous: OrderState | null = null;
    try {
      previous = await withWorkerTransaction(commerce, async (transaction) => {
        const selected = await transaction.query<OrderState>(
          `SELECT id, COALESCE(metadata, '{}'::jsonb) AS metadata
           FROM public."order" WHERE id = $1 AND deleted_at IS NULL
             AND metadata->>'organization_id' = $2 FOR UPDATE`,
          [orderId, organizationId],
        );
        const order = selected.rows[0];
        if (!order) return null;
        const updated = await transaction.query(
          `UPDATE public."order"
           SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('oms_status', $3), updated_at = now()
           WHERE id = $1 AND deleted_at IS NULL AND metadata->>'organization_id' = $2`,
          [orderId, organizationId, status],
        );
        if (updated.rowCount !== 1) throw new Error("order_state_changed");
        return order;
      });
      if (!previous) return json({ error: "not_found" }, 404);

      await app.query(
        `SELECT public.append_canonical_order_state($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz)`,
        [organizationId, orderId, status, "status_changed", typeof claims.email === "string" ? claims.email : "admin", idempotencyKey, JSON.stringify({ source: "worker_admin_order_status" }), new Date().toISOString()],
      );
      return json({ status });
    } catch {
      if (previous) {
        try {
          await withWorkerTransaction(commerce, async (transaction) => {
            await transaction.query(
              `UPDATE public."order" SET metadata = $3::jsonb, updated_at = now()
               WHERE id = $1 AND deleted_at IS NULL AND metadata->>'organization_id' = $2
                 AND metadata->>'oms_status' = $4`,
              [orderId, organizationId, JSON.stringify(previous?.metadata ?? {}), status],
            );
          });
        } catch {
          return json({ error: "order_status_recovery_required" }, 503);
        }
      }
      return json({ error: previous ? "canonical_order_state_unavailable" : "order_unavailable" }, previous ? 503 : 404);
    }
  })).response;
}
