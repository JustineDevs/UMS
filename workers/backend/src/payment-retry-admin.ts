import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { finalizeNativeOrderAcrossDatabases } from "./order-finalization.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const tenant = (claims: WorkerAuthClaims) => { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const allowed = (claims: WorkerAuthClaims) => claims.role === "owner" || claims.role === "admin" || (Array.isArray(claims.permissions) && claims.permissions.some((value) => value === "*" || value === "orders:write"));
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const RETRY_ERRORS = new Set([
  "payment_attempt_not_found",
  "payment_not_settled",
  "payment_finalization_in_progress",
]);

export async function handleAdminPaymentRetryRequest(request: Request, appDatabase: WorkerDatabaseClient, commerceDatabase: WorkerDatabaseClient, env: Env, correlationId: string): Promise<Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized", requestId: correlationId }, 401);
  if (!allowed(claims)) return json({ error: "forbidden", requestId: correlationId }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required", requestId: correlationId }, 403);
  const match = new URL(request.url).pathname.match(/^\/(?:api\/)?admin\/payments\/([^/]+)\/retry$/);
  const paymentId = match ? decodeURIComponent(match[1]) : "";
  if (!uuid(paymentId)) return json({ error: "invalid_payment_id", requestId: correlationId }, 400);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required", requestId: correlationId }, 400);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, paymentId }))).then((bytes) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join(""));
  const actor = typeof claims.email === "string" ? claims.email : claims.sub;
  return (await executeIdempotently(new HyperdriveIdempotencyStore(appDatabase), `payment-retry:${organizationId}:${paymentId}:${key}`, hash, async () => {
    try {
      const result = await finalizeNativeOrderAcrossDatabases(appDatabase, commerceDatabase, paymentId, organizationId);
      await appDatabase.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", ["payment.retry", `payment_attempt:${paymentId}`, JSON.stringify({ organization_id: organizationId, actor_subject: actor, order_id: result.orderId, replayed: result.replayed })]);
      return json({ orderId: result.orderId, replayed: result.replayed });
    } catch (error) {
      const rawCode = error instanceof Error ? error.message : "";
      const code = RETRY_ERRORS.has(rawCode) ? rawCode : "payment_retry_failed";
      const status = code === "payment_attempt_not_found" ? 404 : code === "payment_not_settled" || code === "payment_finalization_in_progress" ? 409 : 422;
      return json({ error: code, requestId: correlationId }, status);
    }
  })).response;
}
