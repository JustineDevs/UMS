import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type CountRow = { count: number | string };

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

export async function handleAdminTasksTodayRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const [stale, needsReview] = await Promise.all([
    database.query<CountRow>("SELECT COUNT(*)::int AS count FROM public.payment_attempts WHERE organization_id = $1 AND status = ANY($2::text[]) AND medusa_order_id IS NULL", [organizationId, ["paid_awaiting_order", "finalizing_order", "paid"]]),
    database.query<CountRow>("SELECT COUNT(*)::int AS count FROM public.payment_attempts WHERE organization_id = $1 AND status = $2", [organizationId, "needs_review"]),
  ]);
  const staleCount = Number(stale.rows[0]?.count) || 0;
  const reviewCount = Number(needsReview.rows[0]?.count) || 0;
  const tasks: Array<Record<string, unknown>> = [];
  if (staleCount > 0) tasks.push({ id: "stale-payment-attempts", type: "pending_review", title: "Stale payment sessions", description: `${staleCount} checkout attempts need recovery or finalization review`, urgency: staleCount > 5 ? "high" : "medium", link: "/admin/payments", count: staleCount });
  if (reviewCount > 0) tasks.push({ id: "payment-needs-review", type: "pending_review", title: "Payment attempts need review", description: `${reviewCount} payment rows are already marked for operator review`, urgency: reviewCount > 5 ? "high" : "medium", link: "/admin/payments", count: reviewCount });
  tasks.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[String(a.urgency)] ?? 3) - ({ high: 0, medium: 1, low: 2 }[String(b.urgency)] ?? 3));
  return json({ tasks });
}
