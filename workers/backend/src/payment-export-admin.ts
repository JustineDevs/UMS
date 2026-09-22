import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function allowed(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "analytics:export"); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function csv(value: unknown): string { const text = String(value ?? ""); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

export async function handlePaymentAttemptsExportRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!allowed(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const result = await database.query<Record<string, unknown>>("SELECT id, provider, status, amount_minor, currency, updated_at FROM public.payment_attempts WHERE organization_id = $1 ORDER BY updated_at DESC LIMIT 500", [organizationId]);
  const lines = ["id,provider,status,amount_minor,currency,updated_at", ...result.rows.map((row) => [row.id, row.provider, row.status, row.amount_minor, row.currency, row.updated_at].map(csv).join(","))];
  const body = `${lines.join("\n")}\n`;
  if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) return json({ error: "export_too_large" }, 413);
  await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["payment_attempts.export", "payment_attempts", JSON.stringify({ organization_id: organizationId, actor_id: claims.sub ?? null, count: result.rows.length, correlation_id: request.headers.get("x-correlation-id") })]);
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="payment-attempts.csv"', "Cache-Control": "no-store" } });
}
