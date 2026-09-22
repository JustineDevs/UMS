import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (c: WorkerAuthClaims) => { const value = c.organization_id ?? c.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const canRead = (c: WorkerAuthClaims) => c.role === "owner" || c.role === "admin" || (Array.isArray(c.permissions) && c.permissions.some((p) => p === "*" || p === "dashboard:read"));

export async function handleAdminWorkflowEntitiesRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const url = new URL(request.url); const rawLimit = url.searchParams.get("limit"); const rawOffset = url.searchParams.get("offset");
  const limit = rawLimit == null || rawLimit.trim() === "" ? 50 : Number(rawLimit); const offset = rawOffset == null || rawOffset.trim() === "" ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || offset > 100_000) return json({ error: "invalid_pagination" }, 400);
  const entityType = url.searchParams.get("entity_type")?.trim() || null;
  if (entityType && !/^[a-z][a-z0-9_]{0,63}$/.test(entityType)) return json({ error: "invalid_entity_type" }, 400);
  const values: unknown[] = [organizationId]; let sql = "SELECT id, entity_type, entity_id, state, previous_state, notes, actor_email, updated_at FROM public.admin_entity_workflow WHERE organization_id = $1";
  if (entityType) { values.push(entityType); sql += ` AND entity_type = $${values.length}`; }
  values.push(limit, offset); sql += ` ORDER BY updated_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;
  const result = await database.query(sql, values);
  return json({ rows: result.rows.map((row) => ({ id: String(row.id), entity_type: String(row.entity_type), entity_id: String(row.entity_id), state: String(row.state), previous_state: row.previous_state == null ? null : String(row.previous_state), notes: row.notes == null ? null : String(row.notes).slice(0, 2_000), actor_email: row.actor_email == null ? null : String(row.actor_email), updated_at: String(row.updated_at) })) });
}
