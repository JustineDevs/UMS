import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type LedgerRow = { id: string; created_at: string; actor_email: string | null; reason: string; reference_type: string; reference_id: string; product_id: string; variant_id: string; location_id: string | null; quantity_before: number | string | null; quantity_after: number | string; quantity_delta: number | string };

function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function org(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "inventory:read"); }
function bounded(value: string | null, max = 200): string | null | undefined { if (value === null || value === "") return null; const result = value.trim(); return result.length > max ? undefined : result; }

export async function handleInventoryLedgerRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = org(claims); if (!organizationId) return json({ error: "organization_scope_required" }, 403);
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get("limit"); const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return json({ error: "invalid_limit" }, 400);
  const variantId = bounded(params.get("variant_id")); const productId = bounded(params.get("product_id"));
  if (variantId === undefined || productId === undefined) return json({ error: "invalid_filter" }, 400);
  const values: unknown[] = [organizationId]; const filters = ["organization_id = $1"];
  if (variantId) { values.push(variantId); filters.push(`variant_id = $${values.length}`); }
  if (productId) { values.push(productId); filters.push(`product_id = $${values.length}`); }
  values.push(limit);
  const result = await database.query<LedgerRow>(`SELECT id, created_at, actor_email, reason, reference_type, reference_id, product_id, variant_id, location_id, quantity_before, quantity_after, quantity_delta FROM public.staff_catalog_inventory_audit WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length}`, values);
  const data = result.rows.map((row) => ({ ...row, quantity_before: row.quantity_before === null ? null : Number(row.quantity_before), quantity_after: Number(row.quantity_after), quantity_delta: Number(row.quantity_delta) }));
  return json({ data, organization_id: organizationId });
}
