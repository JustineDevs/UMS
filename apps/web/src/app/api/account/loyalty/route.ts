import { NextRequest, NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimit = await rateLimitFixedWindow(
    `account-loyalty:${getRequestIp(request)}`,
    30,
    60_000,
  );
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  const email = (await getStorefrontSession())?.user?.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Loyalty wallet is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: account, error: accountError } = await supabase
      .from("loyalty_accounts")
      .select("id,points_balance,lifetime_points,tier,updated_at")
      .eq("customer_email", email)
      .maybeSingle();
    if (accountError) throw accountError;

    if (!account) {
      return NextResponse.json({ account: null, transactions: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: transactions, error: transactionError } = await supabase
      .from("loyalty_transactions")
      .select("id,points_delta,reason,order_id,created_at")
      .eq("loyalty_account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (transactionError) throw transactionError;

    return NextResponse.json(
      { account, transactions: transactions ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[account-loyalty] lookup failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Loyalty wallet is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
