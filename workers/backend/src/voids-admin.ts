import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (c: WorkerAuthClaims) => { const value = c.organization_id ?? c.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const can = (c: WorkerAuthClaims) => c.role === "owner" || c.role === "admin" || (Array.isArray(c.permissions) && c.permissions.some((p) => p === "*" || p === "pos:void"));
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const actions = new Set(["void_item", "void_order", "refund", "discount_override"]);

export async function handleAdminVoidsRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401); if (!can(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    const url = new URL(request.url); const rawLimit = url.searchParams.get("limit"); const limit = rawLimit == null || rawLimit.trim() === "" ? 100 : Number(rawLimit); const shiftId = url.searchParams.get("shift_id")?.trim() || null;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (shiftId !== null && !uuid(shiftId))) return json({ error: "invalid_query" }, 400);
    const values: unknown[] = [organizationId]; let sql = "SELECT id, shift_id, employee_id, approved_by, order_id, line_item_id, action, amount, reason, pin_verified, created_at FROM public.pos_voids WHERE organization_id=$1"; if (shiftId) { values.push(shiftId); sql += ` AND shift_id=$${values.length}`; } values.push(limit); sql += ` ORDER BY created_at DESC LIMIT $${values.length}`;
    const result = await database.query(sql, values); return json({ data: result.rows.map((row) => ({ id: String(row.id), shift_id: row.shift_id == null ? null : String(row.shift_id), employee_id: String(row.employee_id), approved_by: row.approved_by == null ? null : String(row.approved_by), order_id: row.order_id == null ? null : String(row.order_id), line_item_id: row.line_item_id == null ? null : String(row.line_item_id), action: String(row.action), amount: row.amount == null ? null : Number(row.amount), reason: row.reason == null ? null : String(row.reason).slice(0, 500), pin_verified: Boolean(row.pin_verified), created_at: String(row.created_at) })) });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let body: unknown; try { const raw = await request.arrayBuffer(); if (raw.byteLength > 32 * 1024) return json({ error: "payload_too_large" }, 413); body = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload" }, 400); const input = body as Record<string, unknown>; const employeeId = input.employee_id; const action = input.action; const amount = input.amount == null ? null : Number(input.amount);
  if (!uuid(employeeId) || !actions.has(String(action)) || (input.shift_id != null && !uuid(input.shift_id)) || (input.approved_by != null && !uuid(input.approved_by)) || (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000))) return json({ error: "invalid_payload" }, 400);
  const orderId = typeof input.order_id === "string" ? input.order_id.trim().slice(0, 120) || null : null; const lineItemId = typeof input.line_item_id === "string" ? input.line_item_id.trim().slice(0, 120) || null : null; const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) || null : null; const pinVerified = input.pin_verified === true;
  const employee = await database.query("SELECT id FROM public.employees WHERE id=$1 AND organization_id=$2 AND is_active=true LIMIT 1", [employeeId, organizationId]); if (!employee.rows[0]) return json({ error: "employee_not_found" }, 404);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, employeeId, action, amount, orderId, lineItemId, shiftId: input.shift_id ?? null }))).then((bytes) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join(""));
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `pos-void:${organizationId}:${key}`, hash, async () => { const result = await database.query("INSERT INTO public.pos_voids (organization_id,shift_id,employee_id,approved_by,order_id,medusa_order_id,line_item_id,action,amount,reason,pin_verified) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10) RETURNING id,shift_id,employee_id,approved_by,order_id,line_item_id,action,amount,reason,pin_verified,created_at", [organizationId, input.shift_id ?? null, employeeId, input.approved_by ?? null, orderId, lineItemId, action, amount, reason, pinVerified]); const row = result.rows[0]; if (!row) return json({ error: "void_create_failed" }, 502); await database.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", ["pos.void.create", `pos_void:${row.id}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub ?? null, action })]); return json({ data: row }, 201); })).response;
}
