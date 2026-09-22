import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function org(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function allowed(claims: WorkerAuthClaims, write: boolean): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; const needed = write ? "content:write" : "content:read"; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === needed || !write && value === "content:write"); }
function row(value: Record<string, unknown> | undefined): Record<string, unknown> | null { return value ? { id: String(value.id ?? "default"), webhook_url: value.webhook_url == null ? null : String(value.webhook_url), notify_email: value.notify_email == null ? null : String(value.notify_email), updated_at: String(value.updated_at ?? "") } : null; }
async function digest(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function handleAdminCmsFormSettingsRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PUT") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = org(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!allowed(claims, request.method === "PUT")) return json({ error: "forbidden" }, 403);
  if (request.method === "GET") {
    const result = await database.query<Record<string, unknown>>("SELECT id, webhook_url, notify_email, updated_at FROM public.cms_form_settings WHERE id = $1 AND organization_id = $2 LIMIT 1", ["default", organizationId]);
    return json({ data: row(result.rows[0]) });
  }
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > 32 * 1024) return json({ error: "payload_too_large" }, 413); body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_form_settings_payload" }, 400);
  const input = body as Record<string, unknown>;
  const webhookUrl = input.webhook_url === undefined || input.webhook_url === null ? input.webhook_url ?? null : typeof input.webhook_url === "string" && input.webhook_url.length <= 2048 ? input.webhook_url : undefined;
  const notifyEmail = input.notify_email === undefined || input.notify_email === null ? input.notify_email ?? null : typeof input.notify_email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.notify_email) && input.notify_email.length <= 320 ? input.notify_email : undefined;
  if (webhookUrl === undefined || notifyEmail === undefined || Object.keys(input).some((keyName) => !["webhook_url", "notify_email"].includes(keyName))) return json({ error: "invalid_form_settings_payload" }, 400);
  const hash = await digest(JSON.stringify({ organizationId, webhook_url: webhookUrl, notify_email: notifyEmail }));
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-form-settings:${organizationId}:${key}`, hash, async () => {
    const result = await database.query<Record<string, unknown>>("INSERT INTO public.cms_form_settings (id, organization_id, webhook_url, notify_email, updated_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (organization_id, id) DO UPDATE SET webhook_url = EXCLUDED.webhook_url, notify_email = EXCLUDED.notify_email, updated_at = now() RETURNING id, webhook_url, notify_email, updated_at", ["default", organizationId, webhookUrl, notifyEmail]);
    const data = row(result.rows[0]);
    if (!data) return json({ error: "form_settings_write_failed" }, 500);
    await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.form_settings.update", "form-settings:default", JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub })]);
    return json({ data });
  })).response;
}
