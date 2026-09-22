import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const permissions: Record<string, { read: string; write: string }> = { catalog_product: { read: "catalog:read", write: "catalog:write" }, sales_order: { read: "orders:read", write: "orders:write" }, inventory_adjustment: { read: "inventory:read", write: "inventory:write" }, campaign: { read: "campaigns:read", write: "campaigns:write" }, cms_page: { read: "content:read", write: "content:write" }, chat_order: { read: "chat_orders:manage", write: "chat_orders:manage" } };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function organization(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function allowed(claims: WorkerAuthClaims, permission: string): boolean { const grants = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || grants.some((value) => value === "*" || value === permission); }
async function digest(value: unknown): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function handleAdminOperatorNotesRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL }); if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = organization(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const params = new URL(request.url).searchParams; const entityType = params.get("entity_type")?.trim() ?? ""; const entityId = params.get("entity_id")?.trim() ?? ""; const rule = permissions[entityType];
  if (!rule || !entityId || entityId.length > 200) return json({ error: "invalid_entity" }, 400);
  if (request.method === "GET") { if (!allowed(claims, rule.read)) return json({ error: "forbidden" }, 403); const rows = await database.query<{ id: string; body: string; author_email: string | null; created_at: string }>("SELECT id,body,author_email,created_at FROM public.admin_operator_notes WHERE entity_type=$1 AND entity_id=$2 AND organization_id=$3 ORDER BY created_at DESC LIMIT 50", [entityType, entityId, organizationId]); return json({ notes: rows.rows.map((row) => ({ id: String(row.id), body: String(row.body), author_email: row.author_email == null ? null : String(row.author_email), created_at: String(row.created_at) })) }); }
  if (!allowed(claims, rule.write)) return json({ error: "forbidden" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  let body: Record<string, unknown>; try { const text = await request.text(); if (text.length > 128 * 1024) return json({ error: "payload_too_large" }, 413); const parsed = JSON.parse(text) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_payload" }, 400); body = parsed as Record<string, unknown>; } catch { return json({ error: "invalid_json" }, 400); }
  const note = typeof body.body === "string" ? body.body.trim() : ""; if (!note || note.length > 4000) return json({ error: "invalid_note" }, 400);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `operator-note:${organizationId}:${key}`, await digest({ organizationId, entityType, entityId, note }), async () => { const inserted = await database.query<{ id: string }>("INSERT INTO public.admin_operator_notes (entity_type,entity_id,body,author_email,organization_id) VALUES ($1,$2,$3,$4,$5) RETURNING id", [entityType, entityId, note, typeof claims.email === "string" ? claims.email : claims.sub, organizationId]); if (!inserted.rows[0]) return json({ error: "note_unavailable" }, 503); return json({ id: String(inserted.rows[0].id) }, 201); })).response;
}
