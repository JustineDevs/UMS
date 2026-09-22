import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthConfig } from "./auth.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_CSRF_AGE_MS = 30 * 60 * 1000;
type Env = WorkerAuthConfig & { AUTH_SECRET?: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function ip(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 128);
}

function cookie(request: Request): string | undefined {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("review_csrf="))?.slice("review_csrf=".length);
}

async function csrfValid(token: unknown, suppliedCookie: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!secret || typeof token !== "string" || !suppliedCookie || token !== suppliedCookie) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0].length > 20 || !/^\d+$/.test(parts[0])) return false;
  const issued = Number(parts[0]);
  if (!Number.isSafeInteger(issued) || Date.now() < issued || Date.now() - issued > MAX_CSRF_AGE_MS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts[0]}.${parts[1]}`)));
  const encoded = btoa(String.fromCharCode(...signature)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return encoded === parts[2];
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(raw));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

/** Owns public review mutations and keeps all review writes inside APP_DB. */
export async function handleReviewMutationRequest(request: Request, database: WorkerDatabaseClient, env: Env, kind: "helpful" | "report", reviewId: string): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!UUID.test(reviewId)) return json({ error: "Invalid review" }, 400);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.secret, supabaseUrl: env.supabaseUrl, fetch: env.fetch });
  const input = await body(request);
  if (!input) return json({ error: "Request body too large or invalid" }, 400);
  if (!(await csrfValid(input.csrfToken, cookie(request), env.AUTH_SECRET))) return json({ error: "Security token expired. Reload and try again." }, 403);
  const review = await database.query<{ id: string }>("SELECT id FROM public.product_reviews WHERE id=$1 AND status='approved' LIMIT 1", [reviewId]);
  if (!review.rows[0]) return json({ error: "Review not found" }, 404);
  const requestIp = ip(request);
  if (kind === "helpful") {
    const customerId = claims?.sub?.trim() || null;
    const result = await database.query<{ inserted: boolean; helpful_votes: number | null }>(
      `WITH inserted AS (
        INSERT INTO public.review_helpful_votes (review_id, medusa_customer_id, voter_ip)
        VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING review_id
      ), updated AS (
        UPDATE public.product_reviews pr SET helpful_votes=pr.helpful_votes+1
        FROM inserted i WHERE pr.id=i.review_id AND pr.status='approved'
        RETURNING pr.helpful_votes
      ) SELECT EXISTS (SELECT 1 FROM inserted) AS inserted, (SELECT helpful_votes FROM updated) AS helpful_votes`,
      [reviewId, customerId, requestIp],
    );
    const row = result.rows[0];
    if (!row?.inserted) return json({ error: "Already voted", code: "ALREADY_VOTED" }, 409);
    return json({ ok: true, helpful_votes: row.helpful_votes });
  }
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  const reason = input.reason;
  const details = input.details === null || input.details === undefined ? null : typeof input.details === "string" ? input.details.trim() : "";
  if (!claims || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Sign in required" }, 401);
  if (!["spam", "harassment", "hate", "personal_data", "other"].includes(String(reason)) || (details !== null && details.length > 500)) return json({ error: "Invalid report" }, 400);
  try {
    const result = await withWorkerTransaction(database, async (tx) => {
      await tx.query("INSERT INTO public.product_review_reports (review_id,reporter_email,reporter_ip,reason,details) VALUES ($1,$2,$3,$4,$5)", [reviewId, email, requestIp, reason, details]);
      const count = await tx.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM public.product_review_reports WHERE review_id=$1 AND status='open'", [reviewId]);
      if ((count.rows[0]?.count ?? 0) >= 3) await tx.query("UPDATE public.product_reviews SET status='hidden' WHERE id=$1 AND status='approved'", [reviewId]);
      return count.rows[0]?.count ?? 0;
    });
    return json({ ok: true, open_report_count: result });
  } catch (error) {
    if (error instanceof Error && /23505|duplicate/i.test(error.message)) return json({ error: "Already reported" }, 409);
    return json({ error: "Unable to record report" }, 503);
  }
}
