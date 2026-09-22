import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string; AFTERSHIP_API_KEY?: string; NANGO_API_KEY?: string; PANCAKE_POS_API_KEY?: string };
type ConnectionRow = { provider: string | null };
const providers = { stripe: { keys: [], sdk: "Stripe Checkout Session provider (Cloudflare Worker)" }, paypal: { keys: [], sdk: "@paypal/paypal-server-sdk" }, aftership: { keys: ["AFTERSHIP_API_KEY"], sdk: "@aftership/tracking-sdk" }, nango: { keys: ["NANGO_API_KEY"], sdk: "@nangohq/node" }, pancake_pos: { keys: ["PANCAKE_POS_API_KEY"], sdk: "Pancake POS Open API (server-side REST)" } } as const;
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "settings:read"); }
export async function handleAdminIntegrationHealthRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401); if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const result = await database.query<ConnectionRow>("SELECT provider FROM public.payment_nango_connections WHERE organization_id = $1 AND active = TRUE LIMIT 50", [organizationId]);
  const connected = new Set(result.rows.map((row) => row.provider).filter((value): value is string => Boolean(value)));
  const entries = Object.entries(providers).map(([provider, config]) => { const configured = provider === "stripe" || provider === "paypal" ? connected.has(provider) : config.keys.every((key) => Boolean(env[key as keyof Env]?.trim())); return { provider, status: configured ? "healthy" : "unconfigured", sdkVersion: config.sdk, lastWebhookAt: null, webhookStatus: "unknown", envPresent: configured, note: configured ? provider === "stripe" || provider === "paypal" ? "Organization-scoped Nango merchant connection is active." : "Env keys present for this Worker process." : `Missing env: ${config.keys.join(", ")}` }; });
  return json({ entries });
}
