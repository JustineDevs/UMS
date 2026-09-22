import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function canWrite(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "settings:write"); }
function email(claims: WorkerAuthClaims): string | null { const value = claims.email; return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null; }

export async function handleAdminProfileRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
  const actorEmail = email(claims);
  if (!actorEmail) return json({ error: "email_claim_required" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  let name = "";
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_profile_payload" }, 400);
    const value = (body as Record<string, unknown>).name;
    if (value !== undefined && (typeof value !== "string" || value.length > 200)) return json({ error: "invalid_profile_payload" }, 400);
    name = typeof value === "string" ? value.trim() : "";
  } catch { return json({ error: "invalid_json" }, 400); }
  const requestHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ actorEmail, name }))))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `admin-profile:${claims.sub}:${key}`, requestHash, async () => {
    const result = await database.query("UPDATE public.users SET name=$1, updated_at=now() WHERE lower(email)=lower($2) RETURNING name", [name || null, actorEmail]);
    if (!result.rowCount) return json({ error: "profile_not_found" }, 404);
    return json({ ok: true, name: result.rows[0]?.name ?? null });
  })).response;
}
