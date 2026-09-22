import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type AuditRow = {
  id: string;
  action: string;
  resource: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function canRead(claims: WorkerAuthClaims, csv: boolean): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  const needed = csv ? "analytics:export" : "dashboard:read";
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === needed);
}

function tenant(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function csv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function filter(value: string | null, max = 128): string | null | undefined {
  if (value === null || value === "") return null;
  const trimmed = value.trim();
  return trimmed.length > max ? undefined : trimmed;
}

export async function handleAuditLogsRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const isCsv = ["csv", "text/csv"].includes((url.searchParams.get("format") ?? "").trim().toLowerCase());
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims, isCsv)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);

  const defaultLimit = isCsv ? 500 : 20;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? defaultLimit : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return json({ error: "invalid_limit" }, 400);
  const resourcePrefix = filter(url.searchParams.get("resource_prefix"));
  const actionPrefix = filter(url.searchParams.get("action_prefix"));
  const actionExact = filter(url.searchParams.get("action"));
  const from = filter(url.searchParams.get("from"));
  const to = filter(url.searchParams.get("to"));
  if ([resourcePrefix, actionPrefix, actionExact, from, to].some((value) => value === undefined)) return json({ error: "invalid_filter" }, 400);
  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) return json({ error: "invalid_date" }, 400);

  const values: unknown[] = [organizationId];
  const predicates = ["(a.details->>'organization_id') = $1"];
  if (resourcePrefix) { values.push(`${resourcePrefix}%`); predicates.push(`a.resource ILIKE $${values.length}`); }
  if (actionExact) { values.push(actionExact); predicates.push(`a.action = $${values.length}`); }
  else if (actionPrefix) { values.push(`${actionPrefix}%`); predicates.push(`a.action ILIKE $${values.length}`); }
  if (from) { values.push(from); predicates.push(`a.created_at >= $${values.length}`); }
  if (to) { values.push(to); predicates.push(`a.created_at <= $${values.length}`); }
  values.push(limit);
  const result = await database.query<AuditRow>(`SELECT a.id, a.action, a.resource, a.details, a.created_at, a.actor_id, u.email AS actor_email, u.name AS actor_name FROM public.audit_logs a LEFT JOIN public.users u ON u.id = a.actor_id WHERE ${predicates.join(" AND ")} ORDER BY a.created_at DESC LIMIT $${values.length}`, values);
  if (isCsv) {
    const lines = ["id,created_at,actor,action,resource,details_json", ...result.rows.map((row) => [row.id, row.created_at, row.actor_email || row.actor_name || "", row.action, row.resource, row.details ? JSON.stringify(row.details) : ""].map(csv).join(","))];
    const body = `${lines.join("\r\n")}\r\n`;
    if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) return json({ error: "export_too_large" }, 413);
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="audit-logs.csv"', "Cache-Control": "no-store" } });
  }
  return new Response(JSON.stringify({ entries: result.rows.map((row) => ({ id: row.id, action: row.action, resource: row.resource, details: row.details, created_at: row.created_at, actor_id: row.actor_id, users: row.actor_email || row.actor_name ? { email: row.actor_email, name: row.actor_name } : null })) }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
