import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type EntityType = "catalog_product" | "sales_order" | "inventory_adjustment" | "campaign" | "cms_page" | "chat_order";
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (c: WorkerAuthClaims) => { const value = c.organization_id ?? c.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const permissions: Record<EntityType, string> = { catalog_product: "catalog:write", sales_order: "orders:write", inventory_adjustment: "inventory:write", campaign: "campaigns:write", cms_page: "content:write", chat_order: "chat_orders:manage" };
const transitions: Record<string, Set<string>> = { draft: new Set(["pending_review", "published", "archived", "failed", "canceled"]), pending_review: new Set(["draft", "approved", "canceled", "failed"]), approved: new Set(["scheduled", "published", "draft", "failed"]), scheduled: new Set(["published", "draft", "canceled"]), published: new Set(["archived", "draft", "failed"]), archived: new Set(["draft"]), failed: new Set(["draft", "pending_review"]), canceled: new Set() };
const allowed = (c: WorkerAuthClaims, permission: string) => c.role === "owner" || c.role === "admin" || (Array.isArray(c.permissions) && c.permissions.some((p) => p === "*" || p === permission));
const entityType = (value: unknown): value is EntityType => typeof value === "string" && Object.prototype.hasOwnProperty.call(permissions, value);
const safeText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : null;

export async function handleAdminWorkflowTransitionRequest(request: Request, appDatabase: WorkerDatabaseClient, commerceDatabase: WorkerDatabaseClient, env: Env, correlationId: string): Promise<Response> {
  void commerceDatabase;
  if (request.method !== "POST") return json({ error: "method_not_allowed", requestId: correlationId }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized", requestId: correlationId }, 401);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required", requestId: correlationId }, 403);
  let body: unknown; try { const raw = await request.arrayBuffer(); if (raw.byteLength > 32 * 1024) return json({ error: "payload_too_large", requestId: correlationId }, 413); body = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "invalid_json", requestId: correlationId }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload", requestId: correlationId }, 400);
  const input = body as Record<string, unknown>; const type = input.entity_type; const id = safeText(input.entity_id, 200); const toState = safeText(input.to_state, 40); const notes = input.notes == null ? null : safeText(input.notes, 2_000); const expected = input.expected_updated_at == null ? null : safeText(input.expected_updated_at, 80);
  if (!entityType(type) || !id || !toState || (input.notes != null && notes === null) || (input.expected_updated_at != null && expected === null)) return json({ error: "invalid_payload", requestId: correlationId }, 400);
  if (!allowed(claims, permissions[type])) return json({ error: "forbidden", requestId: correlationId }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key || key.length > 255) return json({ error: "idempotency_key_required", requestId: correlationId }, 400);
  if (!transitions[toState]) return json({ error: "invalid_state", requestId: correlationId }, 400);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, type, id, toState, notes, expected }))).then((bytes) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join(""));
  const actor = typeof claims.email === "string" ? claims.email : claims.sub ?? null;
  return (await executeIdempotently(new HyperdriveIdempotencyStore(appDatabase), `workflow-transition:${organizationId}:${type}:${id}:${key}`, hash, async () => {
    const scopedTables: Partial<Record<EntityType, string>> = { campaign: "campaigns", chat_order: "chat_order_intake", cms_page: "cms_pages", inventory_adjustment: "staff_catalog_inventory_audit" };
    const table = scopedTables[type];
    if (table) {
      const exists = await appDatabase.query(`SELECT id FROM public.${table} WHERE id = $1 AND organization_id = $2 LIMIT 1`, [id, organizationId]);
      if (!exists.rows[0]) return json({ error: "not_found", requestId: correlationId }, 404);
    }
    const current = await appDatabase.query<{ state: string; updated_at: string }>("SELECT state, updated_at FROM public.admin_entity_workflow WHERE organization_id=$1 AND entity_type=$2 AND entity_id=$3 LIMIT 1", [organizationId, type, id]);
    const from = String(current.rows[0]?.state ?? "draft");
    if (expected && (!current.rows[0] || String(current.rows[0].updated_at) !== expected)) return json({ error: "WORKFLOW_CONFLICT", message: "Workflow changed; reload before transitioning", requestId: correlationId }, 409);
    if (!transitions[from]?.has(toState)) return json({ error: "WORKFLOW_TRANSITION", message: `Cannot transition from ${from} to ${toState}`, requestId: correlationId }, 400);
    await appDatabase.query("INSERT INTO public.admin_entity_workflow (entity_type,entity_id,organization_id,state,previous_state,notes,actor_email,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT (organization_id,entity_type,entity_id) DO UPDATE SET state=EXCLUDED.state, previous_state=EXCLUDED.previous_state, notes=EXCLUDED.notes, actor_email=EXCLUDED.actor_email, updated_at=now()", [type, id, organizationId, toState, from, notes, actor]);
    await appDatabase.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", ["workflow.transition", `${type}:${id}`, JSON.stringify({ organization_id: organizationId, actor_subject: actor, from_state: from, to_state: toState })]);
    return json({ state: toState });
  })).response;
}
