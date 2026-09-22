import { NextRequest, NextResponse } from "next/server";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readResponseJson } from "@/lib/read-response-json";
import { customerLoyaltyResponseSchema } from "@/lib/admin-api-contracts";

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

  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return NextResponse.json({ error: "Loyalty wallet is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" }, { status: 503 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const response = await fetch(`${baseUrl}/store/customers/me/loyalty`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      const payload = await readResponseJson(response, { error: "invalid_worker_response" });
      return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
    }
    const payload = await readResponseJson(response, { error: "invalid_worker_response" });
    const parsed = customerLoyaltyResponseSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "invalid_worker_response" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(parsed.data, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[account-loyalty] lookup failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Loyalty wallet is temporarily unavailable", code: "LOYALTY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
