import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readResponseJson } from "@/lib/read-response-json";
import { loyaltyBalanceResponseSchema } from "@/lib/admin-api-contracts";

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`loyalty-balance:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // The local E2E identity is deliberately not backed by a Supabase access
  // token. Treat it like an authenticated customer with no loyalty account so
  // checkout remains usable without weakening production authentication.
  if (process.env.UVS_E2E_LOCAL === "1") {
    return NextResponse.json(
      loyaltyBalanceResponseSchema.parse({ balance: 0, currency: "php" }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const response = await fetch(`${baseUrl}/store/customers/me/loyalty`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await readResponseJson<{ account?: { points_balance?: number } | null } | null>(response, null);
    if (!response.ok) {
      return NextResponse.json(
        payload ?? { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
        { status: response.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!payload) {
      return NextResponse.json(
        { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
        { status: 503 },
      );
    }
    const rawBalance = payload.account?.points_balance ?? 0;
    const balance = typeof rawBalance === "number" && Number.isFinite(rawBalance) ? Math.max(0, Math.trunc(rawBalance)) : 0;
    return NextResponse.json(loyaltyBalanceResponseSchema.parse({ balance, currency: "php" }));
  } catch (error) {
    console.error("[checkout-loyalty-balance] lookup failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Loyalty balance is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
