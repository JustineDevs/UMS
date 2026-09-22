import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (claims: WorkerAuthClaims) => { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const allowed = (claims: WorkerAuthClaims, write: boolean) => claims.role === "owner" || claims.role === "admin" || (Array.isArray(claims.permissions) && claims.permissions.some((value) => value === "*" || value === (write ? "settings:write" : "settings:read")));
function safePayload(value: unknown): Record<string, unknown> | null { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const body = value as Record<string, unknown>; if (Object.keys(body).length > 100) return null; if (JSON.stringify(body).length > 512 * 1024) return null; return body; }

export async function handleAdminStorefrontHomeRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PUT") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!allowed(claims, request.method === "PUT")) return json({ error: "forbidden" }, 403);
  if (request.method === "GET") { const result = await database.query<{ payload: unknown; updated_at?: string }>("SELECT payload, updated_at FROM public.storefront_home_content WHERE id = $1 LIMIT 1", ["default"]); const payload = safePayload(result.rows[0]?.payload) ?? {}; return json({ data: payload, devMode: false, updated_at: result.rows[0]?.updated_at ?? null }); }
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let payload: Record<string, unknown>; try { const raw = await request.text(); if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413); const parsed = safePayload(JSON.parse(raw)); if (!parsed) return json({ error: "invalid_storefront_home_payload" }, 400); payload = parsed; } catch { return json({ error: "invalid_json" }, 400); }
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `storefront-home:${organizationId}:${key}`, hash, async () => withWorkerTransaction(database, async (tx) => {
    if (!await lockCmsMediaReferences(tx, organizationId, payload)) return json({ error: "media_reference_deleted" }, 409);
    await tx.query("INSERT INTO public.storefront_home_content (id,payload,updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()", ["default", JSON.stringify(payload)]);
    await tx.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", ["storefront.home.upsert", "storefront_home_content", JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub })]);
    return json({ data: payload, devMode: false });
  }))).response;
}
