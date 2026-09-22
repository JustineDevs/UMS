import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type Row = Record<string, unknown>;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function org(c: WorkerAuthClaims): string | null { const v = c.organization_id ?? c.org_id; return typeof v === "string" && v.trim() ? v.trim() : null; }
function can(c: WorkerAuthClaims, write: boolean): boolean { const p = Array.isArray(c.permissions) ? c.permissions : []; return c.role === "owner" || c.role === "admin" || p.some((v) => v === "*" || v === (write ? "crm:write" : "crm:read")); }
async function access(r: Request, e: Env, write: boolean): Promise<{ claims: WorkerAuthClaims; organizationId: string } | Response> { const c = await verifyWorkerBearerToken(r.headers.get("Authorization"), { secret: e.CMS_ADMIN_JWT_SECRET, supabaseUrl: e.SUPABASE_URL }); if (!c) return json({ error: "unauthorized" }, 401); if (!can(c, write)) return json({ error: "forbidden" }, 403); const organizationId = org(c); return organizationId ? { claims: c, organizationId } : json({ error: "organization_claim_required" }, 403); }
async function hash(v: unknown): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(v))))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function record(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function text(v: unknown, max: number): string | null { return typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null; }
function email(v: unknown): string | null { const x = text(v, 320)?.toLowerCase() ?? null; return x && EMAIL.test(x) ? x : null; }
function iso(v: unknown): string | null { const x = text(v, 64); return x && !Number.isNaN(Date.parse(x)) ? x : null; }
function boundedMetadata(v: unknown): Record<string, unknown> { const x = record(v); return JSON.stringify(x).length <= 32 * 1024 ? x : {}; }
function safeRow(row: Row): Row { return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v])); }
async function audit(db: WorkerDatabaseClient, action: string, resource: string, organizationId: string, claims: WorkerAuthClaims): Promise<void> { await db.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", [action, resource, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub })]); }
async function body(request: Request): Promise<Record<string, unknown> | Response> { try { const raw = await request.text(); if (raw.length > 256 * 1024) return json({ error: "payload_too_large" }, 413); const parsed = JSON.parse(raw); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : json({ error: "invalid_payload" }, 400); } catch { return json({ error: "invalid_json" }, 400); } }
function key(r: Request): string | Response { const k = r.headers.get("Idempotency-Key")?.trim(); return k || json({ error: "idempotency_key_required" }, 400); }
const activitySelect = "id,customer_email,activity_type,subject,body,owner_email,occurred_at,due_at,completed_at,metadata,created_at,updated_at";
const dealSelect = "id,customer_email,title,stage,value,probability,owner_email,expected_close_at,source,metadata,created_at,updated_at";
const goalSelect = "id,owner_email,period_start,period_end,target_value,target_deals,metadata,created_at,updated_at";

export async function handleAdminCrmOperationsRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const a = await access(request, env, request.method !== "GET"); if (a instanceof Response) return a; const { claims, organizationId } = a;
  if (request.method === "GET") {
    const [activities, deals, goals] = await Promise.all([
      database.query<Row>(`SELECT ${activitySelect} FROM public.crm_activities WHERE organization_id=$1 ORDER BY occurred_at DESC LIMIT 200`, [organizationId]),
      database.query<Row>(`SELECT ${dealSelect} FROM public.crm_pipeline_deals WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 200`, [organizationId]),
      database.query<Row>(`SELECT ${goalSelect} FROM public.crm_goals WHERE organization_id=$1 ORDER BY period_start DESC LIMIT 100`, [organizationId]),
    ]);
    return json({ data: { activities: activities.rows.map(safeRow), deals: deals.rows.map(safeRow), goals: goals.rows.map(safeRow) } });
  }
  const idempotency = key(request); if (idempotency instanceof Response) return idempotency;
  const parsed = await body(request); if (parsed instanceof Response) return parsed;
  const input = parsed; const actor = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : claims.sub;
  if (request.method === "POST") {
    const kind = input.kind;
    if (kind === "activity" || kind === "deal") {
      const customer = email(input.customer_email); if (!customer) return json({ error: "invalid_customer_email" }, 400);
      const idempotencyHash = await hash({ organizationId, input });
      return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `crm-operation:${organizationId}:${idempotency}`, idempotencyHash, async () => {
        let result;
        if (kind === "activity") { const subject = text(input.subject, 240); const type = text(input.activity_type, 20); if (!subject || !["email", "call", "meeting", "note", "task"].includes(type ?? "")) return json({ error: "invalid_activity" }, 400); result = await database.query<Row>(`INSERT INTO public.crm_activities (organization_id,customer_email,activity_type,subject,body,owner_email,occurred_at,due_at,completed_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING ${activitySelect}`, [organizationId, customer, type, subject, text(input.body, 10000), actor, iso(input.occurred_at) ?? new Date().toISOString(), iso(input.due_at), input.completed === true ? new Date().toISOString() : null, JSON.stringify(boundedMetadata(input.metadata))]); }
        else { const title = text(input.title, 240); if (!title) return json({ error: "invalid_deal" }, 400); result = await database.query<Row>(`INSERT INTO public.crm_pipeline_deals (organization_id,customer_email,title,stage,value,probability,owner_email,expected_close_at,source,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING ${dealSelect}`, [organizationId, customer, title, text(input.stage, 40) ?? "qualified", typeof input.value === "number" && Number.isFinite(input.value) ? input.value : 0, typeof input.probability === "number" && Number.isFinite(input.probability) ? Math.min(1, Math.max(0, input.probability)) : 0.25, actor, iso(input.expected_close_at), text(input.source, 120), JSON.stringify(boundedMetadata(input.metadata))]); }
        const row = result.rows[0]; if (!row) return json({ error: "crm_write_failed" }, 502); await audit(database, `crm.${kind}.create`, `${kind}:${row.id}`, organizationId, claims); return json({ data: safeRow(row) }, 201);
      })).response;
    }
    if (kind !== "goal") return json({ error: "invalid_operation_kind" }, 400);
    const start = text(input.period_start, 10); const end = text(input.period_end, 10); if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return json({ error: "invalid_goal_period" }, 400);
    const idempotencyHash = await hash({ organizationId, input });
    return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `crm-operation:${organizationId}:${idempotency}`, idempotencyHash, async () => { const result = await database.query<Row>(`INSERT INTO public.crm_goals (organization_id,owner_email,period_start,period_end,target_value,target_deals,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (organization_id,owner_email,period_start,period_end) DO UPDATE SET target_value=EXCLUDED.target_value,target_deals=EXCLUDED.target_deals,metadata=EXCLUDED.metadata,updated_at=now() RETURNING ${goalSelect}`, [organizationId, actor, start, end, typeof input.target_value === "number" && input.target_value >= 0 ? input.target_value : 0, Number.isInteger(input.target_deals) && (input.target_deals as number) >= 0 ? input.target_deals : 0, JSON.stringify(boundedMetadata(input.metadata))]); const row = result.rows[0]; if (!row) return json({ error: "crm_write_failed" }, 502); await audit(database, "crm.goal.upsert", `goal:${row.id}`, organizationId, claims); return json({ data: safeRow(row) }, 201); })).response;
  }
  const id = text(input.id, 80); const kind = input.kind; if (!id || !["activity", "deal"].includes(String(kind))) return json({ error: "invalid_operation_identity" }, 400); const table = kind === "activity" ? "crm_activities" : "crm_pipeline_deals"; const idempotencyHash = await hash({ organizationId, input });
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `crm-operation:${organizationId}:${idempotency}`, idempotencyHash, async () => {
    if (request.method === "DELETE") { const result = await database.query<Row>(`DELETE FROM public.${table} WHERE id=$1 AND organization_id=$2 RETURNING id`, [id, organizationId]); if (!result.rows[0]) return json({ error: "crm_record_not_found" }, 404); await audit(database, `crm.${kind}.delete`, `${kind}:${id}`, organizationId, claims); return json({ ok: true }); }
    const values: Record<string, unknown> = {}; const fields = kind === "deal" ? ["title", "stage", "value", "probability", "expected_close_at", "source"] : ["subject", "body", "activity_type", "occurred_at", "due_at"];
    for (const field of fields) if (input[field] !== undefined) values[field] = field.endsWith("_at") || field === "occurred_at" ? iso(input[field]) : input[field]; if (kind === "activity" && input.completed !== undefined) values.completed_at = input.completed === true ? new Date().toISOString() : null; if (!Object.keys(values).length) return json({ error: "empty_update" }, 400);
    const columns = Object.keys(values); const result = await database.query<Row>(`UPDATE public.${table} SET ${columns.map((c, i) => `${c}=$${i + 3}`).join(",")},updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING ${kind === "deal" ? dealSelect : activitySelect}`, [id, organizationId, ...columns.map((c) => values[c])]); const row = result.rows[0]; if (!row) return json({ error: "crm_record_not_found" }, 404); await audit(database, `crm.${kind}.update`, `${kind}:${id}`, organizationId, claims); return json({ data: safeRow(row) });
  })).response;
}
