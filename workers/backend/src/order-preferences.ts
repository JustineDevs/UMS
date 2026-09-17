import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken } from "./auth.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string; DEFAULT_ORGANIZATION_ID?: string };
type Action = "remove_and_continue" | "cancel_order" | "ask_me";
const ACTIONS: readonly Action[] = ["remove_and_continue", "cancel_order", "ask_me"];

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

function emailFromClaims(claims: Record<string, unknown>) {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

export async function handleCustomerOrderPreferencesRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const email = emailFromClaims(claims);
  if (!email) return json({ error: "email_claim_required" }, 403);
  const organizationId = env.DEFAULT_ORGANIZATION_ID?.trim() || null;
  if (!organizationId) return json({ error: "organization_not_configured" }, 503);

  if (request.method === "PATCH") {
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const action = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).outOfStockAction
      : null;
    if (typeof action !== "string" || !ACTIONS.includes(action as Action)) return json({ error: "invalid_out_of_stock_action" }, 400);
    const result = await database.query(
      `INSERT INTO public.customer_order_preferences (organization_id, customer_email, out_of_stock_action, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (organization_id, customer_email) DO UPDATE SET out_of_stock_action = EXCLUDED.out_of_stock_action, updated_at = now()
       RETURNING organization_id, customer_email, out_of_stock_action, updated_at`,
      [organizationId, email, action],
    );
    return json({ preference: result.rows[0] ?? null });
  }

  const result = await database.query(
    `SELECT organization_id, customer_email, out_of_stock_action, updated_at
       FROM public.customer_order_preferences
      WHERE organization_id = $1 AND lower(customer_email) = $2
      LIMIT 1`,
    [organizationId, email],
  );
  return json({ preference: result.rows[0] ?? { out_of_stock_action: "remove_and_continue" } });
}
