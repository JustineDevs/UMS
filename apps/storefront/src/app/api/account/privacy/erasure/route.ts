import { NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isPrivacyErasureConfirmation } from "@/lib/account-privacy";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { hasRecentAuthentication } from "@/lib/recent-auth";

const MAX_ERASURE_BODY_BYTES = 2 * 1024;

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const rate = await rateLimitFixedWindow(`account-dsar-erasure:${getRequestIp(req)}`, 2, 60 * 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rate.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec), "Cache-Control": "no-store" } },
    );
  }

  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const authDisabled = process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true";
  if (!authDisabled && !hasRecentAuthentication(session)) {
    return NextResponse.json(
      {
        error: "Please sign in again before deleting your account.",
        code: "RECENT_AUTH_REQUIRED",
        reauthUrl: "/sign-in?callbackUrl=%2Faccount&reauth=1",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const bounded = await parseBoundedJson(req, MAX_ERASURE_BODY_BYTES);
  if (bounded.tooLarge) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  if (!bounded.valid) {
    return NextResponse.json({ error: "Confirmation is required" }, { status: 400 });
  }
  const body = bounded.value;
  if (!isPrivacyErasureConfirmation(body)) {
    return NextResponse.json({ error: "Type DELETE to confirm account erasure" }, { status: 400 });
  }

  const apiUrl = process.env.API_URL?.trim() || "http://localhost:4000";
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (internalKey) headers.Authorization = `Bearer ${internalKey}`;

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/compliance/erasure`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Account erasure is temporarily unavailable." },
        { status: response.status === 404 ? 404 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Account erasure is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
