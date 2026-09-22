import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function tenant(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canRead(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "dashboard:read");
}

export async function handlePaymentRecoveryMetricsRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const rawDays = new URL(request.url).searchParams.get("days");
  const days = rawDays === null || rawDays.trim() === "" ? 14 : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > 90) return json({ error: "invalid_days" }, 400);
  const result = await database.query<{ day: string; count: number | string }>(
    "SELECT TO_CHAR(invalidated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count FROM public.payment_attempts WHERE organization_id = $1 AND invalidated_at IS NOT NULL AND invalidated_at >= NOW() - ($2::int * INTERVAL '1 day') GROUP BY 1 ORDER BY 1",
    [organizationId, days],
  );
  const buckets = result.rows.map((row) => ({ day: row.day, count: Number(row.count) || 0 }));
  return json({ days, buckets, totalInvalidationsInWindow: buckets.reduce((sum, row) => sum + row.count, 0) });
}
