import { NextRequest, NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`loyalty-balance:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getStorefrontSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await sb
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("customer_email", session.user.email)
      .maybeSingle();

    if (error) {
      console.error("[loyalty-balance] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
        { status: 503 },
      );
    }

    const balance = data ? Number((data as { points_balance?: number }).points_balance ?? 0) : 0;
    return NextResponse.json({ balance, currency: "php" });
  } catch (err) {
    console.error(
      "[loyalty-balance] unexpected error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
