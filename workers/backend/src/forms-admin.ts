import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:read" || value === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function csvEscape(value: string): string { return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }
function canWrite(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:write") || claims.role === "owner" || claims.role === "admin"; }
async function digest(value: unknown): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function handleCmsAdminFormSubmissionsRequest(request: Request, database: WorkerDatabaseClient, env: Env, submissionId?: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL }); if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams; const formKey = params.get("form_key")?.trim() || null; const from = params.get("from")?.trim() || null; const to = params.get("to")?.trim() || null; const limit = params.get("limit") === null ? 50 : Number(params.get("limit")); const offset = params.get("offset") === null ? 0 : Number(params.get("offset"));
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || offset > 100000 || [formKey, from, to].some((value) => value && value.length > 64) || [from, to].some((value) => value && Number.isNaN(Date.parse(value)))) return json({ error: "invalid_filters" }, 400);
    const values: unknown[] = [organizationId]; const filters = ["organization_id=$1"]; if (formKey) { values.push(formKey); filters.push(`form_key=$${values.length}`); } if (from) { values.push(from); filters.push(`created_at>=$${values.length}`); } if (to) { values.push(to); filters.push(`created_at<=$${values.length}`); }
    const count = await database.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.cms_form_submissions WHERE ${filters.join(" AND ")}`, values); const rows = await database.query<Record<string, unknown>>(`SELECT id,form_key,payload,created_at,ip_hash,read_at,assigned_to,spam_score FROM public.cms_form_submissions WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]); return json({ data: rows.rows.map((row) => ({ id: String(row.id), form_key: String(row.form_key), payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {}, created_at: String(row.created_at), ip_hash: row.ip_hash == null ? null : String(row.ip_hash), read_at: row.read_at == null ? null : String(row.read_at), assigned_to: row.assigned_to == null ? null : String(row.assigned_to), spam_score: Number(row.spam_score) || 0 })), meta: { total: Number(count.rows[0]?.total) || 0 } });
  }
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403); if (!submissionId?.trim()) return json({ error: "submission_id_required" }, 400); const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  let body: Record<string, unknown>; try { const text = await request.text(); if (text.length > 32 * 1024) return json({ error: "payload_too_large" }, 413); const parsed = JSON.parse(text) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_payload" }, 400); body = parsed as Record<string, unknown>; } catch { return json({ error: "invalid_json" }, 400); }
  const readAt = body.read_at; const assignedTo = body.assigned_to; const spamScore = body.spam_score; if ((readAt !== undefined && readAt !== null && (typeof readAt !== "string" || readAt.length > 64)) || (assignedTo !== undefined && assignedTo !== null && (typeof assignedTo !== "string" || assignedTo.length > 160)) || (spamScore !== undefined && (typeof spamScore !== "number" || !Number.isFinite(spamScore) || spamScore < 0 || spamScore > 1))) return json({ error: "invalid_submission_payload" }, 400);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-form-submission:${organizationId}:${submissionId}:${key}`, await digest({ organizationId, submissionId, readAt, assignedTo, spamScore }), async () => { const updated = await database.query<Record<string, unknown>>("UPDATE public.cms_form_submissions SET read_at=CASE WHEN $1::boolean THEN $2::text ELSE read_at END,assigned_to=CASE WHEN $3::boolean THEN $4::text ELSE assigned_to END,spam_score=CASE WHEN $5::boolean THEN $6::double precision ELSE spam_score END WHERE id=$7 AND organization_id=$8 RETURNING id,form_key,payload,created_at,ip_hash,read_at,assigned_to,spam_score", [readAt !== undefined, readAt, assignedTo !== undefined, assignedTo, spamScore !== undefined, spamScore, submissionId, organizationId]); const row = updated.rows[0]; if (!row) return json({ error: "not_found" }, 404); return json({ data: { id: String(row.id), form_key: String(row.form_key), payload: row.payload ?? {}, created_at: String(row.created_at), ip_hash: row.ip_hash ?? null, read_at: row.read_at ?? null, assigned_to: row.assigned_to ?? null, spam_score: Number(row.spam_score) || 0 } }); })).response;
}

export async function handleCmsAdminFormSubmissionsExportRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const params = new URL(request.url).searchParams;
  const formKey = params.get("form_key")?.trim() || null;
  const from = params.get("from")?.trim() || null;
  const to = params.get("to")?.trim() || null;
  if ([formKey, from, to].some((value) => value && value.length > 64) || [from, to].some((value) => value && Number.isNaN(Date.parse(value)))) return json({ error: "invalid_filters" }, 400);
  const values: unknown[] = [organizationId];
  const filters = ["organization_id = $1"];
  if (formKey) { values.push(formKey); filters.push(`form_key = $${values.length}`); }
  if (from) { values.push(from); filters.push(`created_at >= $${values.length}`); }
  if (to) { values.push(to); filters.push(`created_at <= $${values.length}`); }
  const result = await database.query<Record<string, unknown>>(`SELECT id, form_key, created_at, read_at, assigned_to, spam_score, payload FROM public.cms_form_submissions WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT 1000`, values);
  const lines = ["id,form_key,created_at,read_at,assigned_to,spam_score,payload_json", ...result.rows.map((row) => [row.id, row.form_key, row.created_at, row.read_at, row.assigned_to, Number(row.spam_score) || 0, JSON.stringify(row.payload ?? {})].map((value, index) => index === 5 ? String(value) : csvEscape(String(value ?? ""))).join(","))];
  const body = lines.join("\n");
  if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) return json({ error: "export_too_large" }, 413);
  await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.form_submissions.export", "cms_form_submissions", JSON.stringify({ organization_id: organizationId, actor_id: claims.sub ?? null, count: result.rows.length, correlation_id: request.headers.get("x-correlation-id") })]);
  return new Response(body, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="form-submissions.csv"', "Cache-Control": "no-store" } });
}
