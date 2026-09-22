import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { resolveTrackingCapability, type TrackingEnv } from "./tracking.ts";

type Env = TrackingEnv & { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (claims: WorkerAuthClaims) => { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const can = (claims: WorkerAuthClaims) => claims.role === "owner" || claims.role === "admin" || (Array.isArray(claims.permissions) && claims.permissions.some((p) => p === "*" || p === "orders:write"));

export async function handleAdminTrackingCapabilityRevokeRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!can(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let body: unknown;
  try {
    const raw = await request.arrayBuffer();
    if (raw.byteLength > 16 * 1024) return json({ error: "payload_too_large" }, 413);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload" }, 400);
  const input = body as Record<string, unknown>;
  const rawToken = typeof input.token === "string" ? input.token.trim() : "";
  const token = rawToken.startsWith("cap_") ? rawToken.slice(4) : rawToken;
  const resourceId = typeof input.resourceId === "string" ? input.resourceId.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 240) || null : null;
  if (!token || !/^(order|cart)_[A-Za-z0-9_-]+$/.test(resourceId)) return json({ error: "invalid_payload" }, 400);
  const capability = await resolveTrackingCapability(token, env);
  if (!capability || capability.id !== resourceId || (capability.id.startsWith("cart_") && capability.purpose !== "track")) return json({ error: "invalid_tracking_capability" }, 400);
  const capabilityHashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const capabilityHash = Array.from(new Uint8Array(capabilityHashBytes), (value) => value.toString(16).padStart(2, "0")).join("");
  const requestHashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, token, resourceId, reason })));
  const requestHash = Array.from(new Uint8Array(requestHashBytes), (value) => value.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `tracking-revoke:${organizationId}:${key}`, requestHash, async () => {
    const existing = await database.query<{ organization_id?: string }>("SELECT organization_id FROM public.tracking_capability_revocations WHERE capability_hash=$1 LIMIT 1", [capabilityHash]);
    if (existing.rows[0] && existing.rows[0].organization_id !== organizationId) return json({ error: "invalid_tracking_capability" }, 400);
    await database.query("INSERT INTO public.tracking_capability_revocations (capability_hash,resource_id,revoked_by,reason,organization_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (capability_hash) DO UPDATE SET revoked_at=now(), revoked_by=EXCLUDED.revoked_by, reason=EXCLUDED.reason, organization_id=EXCLUDED.organization_id", [capabilityHash, resourceId, claims.email ?? claims.sub, reason, organizationId]);
    await database.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", ["tracking.capability.revoke", `tracking:${resourceId}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, reason })]);
    return json({ ok: true, revoked: true });
  })).response;
}
