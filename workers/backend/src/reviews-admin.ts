import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type ReviewRow = Record<string, unknown>;
const STATUSES = new Set(["pending", "approved", "rejected", "hidden"]);

function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:read"); }
function canWrite(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:write"); }
async function digest(value: unknown): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function handleAdminReviewsRequest(request: Request, database: WorkerDatabaseClient, env: Env & { reviewId?: string }): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (request.method === "PATCH") {
    if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
    const reviewId = env.reviewId?.trim(); if (!reviewId) return json({ error: "review_id_required" }, 400);
    const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
    let body: Record<string, unknown>; try { const text = await request.text(); if (text.length > 128 * 1024) return json({ error: "payload_too_large" }, 413); const parsed = JSON.parse(text) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_payload" }, 400); body = parsed as Record<string, unknown>; } catch { return json({ error: "invalid_json" }, 400); }
    const status = body.status; const note = body.moderation_note === undefined ? "" : body.moderation_note; const shadowBanned = body.shadow_banned; const expected = body.expected_updated_at;
    if (typeof status !== "string" || !STATUSES.has(status) || typeof note !== "string" || note.trim().length > 2000 || (shadowBanned !== undefined && typeof shadowBanned !== "boolean") || (expected !== undefined && (typeof expected !== "string" || Number.isNaN(Date.parse(expected))))) return json({ error: "invalid_review_payload" }, 400);
    return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `review:${reviewId}:${key}`, await digest({ reviewId, status, note, shadowBanned, expected }), async () => {
      const values: unknown[] = [status, claims.sub, note.trim() || null, shadowBanned ?? null, reviewId]; const predicates = ["id=$5"]; if (expected !== undefined) { values.push(expected); predicates.push(`updated_at=$${values.length}`); }
      const updated = await database.query<{ id: string; status: string }>(`UPDATE public.product_reviews SET status=$1,moderated_by_staff_email=$2,moderated_at=now(),moderation_note=$3,shadow_banned=COALESCE($4,shadow_banned),updated_at=now() WHERE ${predicates.join(" AND ")} RETURNING id,status`, values);
      if (!updated.rows[0]) return json({ error: expected !== undefined ? "review_changed" : "review_not_found" }, expected !== undefined ? 409 : 404);
      await database.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", ["review.moderate", "product_reviews", JSON.stringify({ review_id: reviewId, actor_id: claims.sub, status })]);
      return json({ ok: true, review: updated.rows[0] });
    })).response;
  }
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const params = new URL(request.url).searchParams;
  const status = params.get("status")?.trim().toLowerCase() ?? "";
  const productId = params.get("medusaProductId")?.trim() ?? "";
  const search = params.get("q")?.trim().toLowerCase() ?? "";
  const rawLimit = params.get("limit"); const limit = rawLimit === null ? 80 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return json({ error: "invalid_limit" }, 400);
  if (status && !STATUSES.has(status)) return json({ error: "invalid_status" }, 400);
  if (productId.length > 200 || search.length > 200) return json({ error: "invalid_filter" }, 400);
  const values: unknown[] = []; const filters: string[] = [];
  if (status) { values.push(status); filters.push(`pr.status = $${values.length}`); }
  if (productId) { values.push(productId); filters.push(`pr.medusa_product_id = $${values.length}`); }
  if (search.length >= 2) { values.push(`%${search.replace(/[%_]/g, " ").trim()}%`); filters.push(`pr.body ILIKE $${values.length}`); }
  values.push(limit);
  const result = await database.query<ReviewRow>(`SELECT pr.id, pr.product_slug, pr.medusa_product_id, pr.rating, pr.author_name, pr.body, pr.status, pr.created_at, pr.customer_email, pr.medusa_customer_id, pr.verified_medusa_order_id, pr.moderated_by_staff_email, pr.is_verified_buyer, pr.risk_score, pr.shadow_banned, pr.moderated_at, pr.moderation_note, (SELECT COUNT(*)::int FROM public.product_review_reports r WHERE r.review_id = pr.id AND r.status = 'open') AS open_report_count FROM public.product_reviews pr${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} ORDER BY pr.created_at DESC LIMIT $${values.length}`, values);
  return json({ reviews: result.rows });
}
