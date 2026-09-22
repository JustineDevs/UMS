import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const projection = "id,name,description,rule_type,rule_config,auto_refresh,member_count,last_refreshed_at,created_at,organization_id";
const ruleTypes = new Set(["spend_above", "spend_below", "order_count_above", "inactive_days", "product_category", "tier", "manual"]);
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function org(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function allowed(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "crm:segments"); }
async function hash(value: unknown): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function body(request: Request): Promise<Record<string, unknown>> { const length = Number(request.headers.get("content-length") ?? 0); if (length > 128 * 1024) throw new Error("payload_too_large"); const text = await request.text(); if (text.length > 128 * 1024) throw new Error("payload_too_large"); const value = JSON.parse(text) as unknown; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_payload"); return value as Record<string, unknown>; }
function segment(row: Record<string, unknown>): Record<string, unknown> { return { id: String(row.id), name: String(row.name), description: row.description == null ? null : String(row.description), rule_type: String(row.rule_type), rule_config: row.rule_config && typeof row.rule_config === "object" && !Array.isArray(row.rule_config) ? row.rule_config : {}, auto_refresh: Boolean(row.auto_refresh), member_count: Number(row.member_count ?? 0), last_refreshed_at: row.last_refreshed_at == null ? null : String(row.last_refreshed_at), created_at: String(row.created_at), organization_id: row.organization_id == null ? null : String(row.organization_id) }; }

export async function handleAdminSegmentsRequest(request: Request, database: WorkerDatabaseClient, env: Env, segmentId?: string): Promise<Response> {
  const isCollection = !segmentId;
  if (request.method !== "GET" && !(isCollection && request.method === "POST")) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401); if (!allowed(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = org(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") { const result = await database.query<Record<string, unknown>>(`SELECT ${projection} FROM public.customer_segments WHERE organization_id=$1 ORDER BY name ASC LIMIT 500`, [organizationId]); return json({ data: result.rows.map(segment) }); }
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  let input: Record<string, unknown>; try { input = await body(request); } catch (error) { const large = error instanceof Error && error.message === "payload_too_large"; return json({ error: large ? "payload_too_large" : "invalid_payload" }, large ? 413 : 400); }
  const name = typeof input.name === "string" ? input.name.trim() : ""; const description = input.description === undefined ? null : typeof input.description === "string" ? input.description.trim() : "invalid"; const ruleType = typeof input.rule_type === "string" ? input.rule_type : ""; const config = input.rule_config === undefined ? {} : input.rule_config; const autoRefresh = input.auto_refresh === undefined ? true : input.auto_refresh;
  if (!name || name.length > 160 || description === "invalid" || (typeof description === "string" && description.length > 1000) || !ruleTypes.has(ruleType) || !config || typeof config !== "object" || Array.isArray(config) || Object.keys(config).length > 100 || typeof autoRefresh !== "boolean") return json({ error: "invalid_segment_payload" }, 400);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `segments:${organizationId}:${key}`, await hash({ organizationId, name, description, ruleType, config, autoRefresh }), async () => { const result = await database.query<Record<string, unknown>>(`INSERT INTO public.customer_segments (name,description,rule_type,rule_config,auto_refresh,organization_id) VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING ${projection}`, [name, description, ruleType, JSON.stringify(config), autoRefresh, organizationId]); return result.rows[0] ? json({ data: segment(result.rows[0]) }, 201) : json({ error: "segment_unavailable" }, 503); })).response;
}

export async function handleAdminSegmentMembersRequest(request: Request, database: WorkerDatabaseClient, env: Env, segmentId: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401); if (!allowed(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = org(claims); if (!organizationId || !segmentId || segmentId.length > 200) return json({ error: "invalid_segment" }, 400);
  const exists = await database.query<{ id: string }>("SELECT id FROM public.customer_segments WHERE id=$1 AND organization_id=$2 LIMIT 1", [segmentId, organizationId]); if (!exists.rows[0]) return json({ error: "segment_not_found" }, 404);
  if (request.method === "GET") { const result = await database.query<{ customer_email: string; medusa_customer_id: string | null }>("SELECT customer_email,medusa_customer_id FROM public.customer_segment_members WHERE segment_id=$1 AND organization_id=$2 ORDER BY added_at DESC LIMIT 500", [segmentId, organizationId]); return json({ data: result.rows.map((row) => ({ customer_email: String(row.customer_email), medusa_customer_id: row.medusa_customer_id == null ? null : String(row.medusa_customer_id) })) }); }
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  let input: Record<string, unknown>; try { input = await body(request); } catch (error) { const large = error instanceof Error && error.message === "payload_too_large"; return json({ error: large ? "payload_too_large" : "invalid_payload" }, large ? 413 : 400); }
  const members = input.members;
  if (!Array.isArray(members) || members.length < 1 || members.length > 500) return json({ error: "invalid_members_payload" }, 400);
  const validMembers = members.every((value): value is Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return typeof item.customer_email === "string" && item.customer_email.trim().length > 0 && item.customer_email.length <= 320 && (item.medusa_customer_id === undefined || typeof item.medusa_customer_id === "string");
  });
  if (!validMembers) return json({ error: "invalid_members_payload" }, 400);
  const normalized = members.map((value) => { const item = value as Record<string, unknown>; return { customer_email: String(item.customer_email).trim().toLowerCase(), medusa_customer_id: item.medusa_customer_id === undefined ? null : String(item.medusa_customer_id).trim() }; });
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `segment-members:${organizationId}:${segmentId}:${key}`, await hash({ organizationId, segmentId, normalized }), async () => { for (const member of normalized) await database.query("INSERT INTO public.customer_segment_members (segment_id,customer_email,medusa_customer_id,organization_id) VALUES ($1,$2,$3,$4) ON CONFLICT (segment_id,customer_email) DO UPDATE SET medusa_customer_id=EXCLUDED.medusa_customer_id", [segmentId, member.customer_email, member.medusa_customer_id, organizationId]); const count = await database.query<{ count: string | number }>("SELECT COUNT(*)::int AS count FROM public.customer_segment_members WHERE segment_id=$1 AND organization_id=$2", [segmentId, organizationId]); await database.query("UPDATE public.customer_segments SET member_count=$1,last_refreshed_at=now() WHERE id=$2 AND organization_id=$3", [Number(count.rows[0]?.count ?? normalized.length), segmentId, organizationId]); return json({ count: Number(count.rows[0]?.count ?? normalized.length) }); })).response;
}
