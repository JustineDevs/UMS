import { verifyWorkerBearerToken } from "./auth.ts";
import type { WorkerDatabaseClient } from "./database.ts";

type LoyaltyEnv = { JWT_SECRET?: string; SUPABASE_URL?: string };
type LoyaltyAccount = { id: string; points_balance: number; lifetime_points: number; tier: string; updated_at: string };
type LoyaltyTransaction = { id: string; points_delta: number; reason: string; order_id: string | null; created_at: string };

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Cache-Control": "no-store", "Content-Type": "application/json" } });

export async function handleCustomerLoyaltyRequest(request: Request, database: WorkerDatabaseClient, env: LoyaltyEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_claim_required" }, 403);
  const accountResult = await database.query<LoyaltyAccount>(`SELECT id, points_balance, lifetime_points, tier, updated_at FROM public.loyalty_accounts WHERE lower(customer_email) = $1 LIMIT 1`, [email]);
  const account = accountResult.rows[0] ?? null;
  if (!account) return json({ account: null, transactions: [] });
  const transactionResult = await database.query<LoyaltyTransaction>(`SELECT id, points_delta, reason, order_id, created_at FROM public.loyalty_transactions WHERE loyalty_account_id = $1 ORDER BY created_at DESC LIMIT 50`, [account.id]);
  return json({ account, transactions: transactionResult.rows });
}
