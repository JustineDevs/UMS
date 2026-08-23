import { NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const rate = await rateLimitFixedWindow(`account-dsar-export:${getRequestIp(req)}`, 3, 60 * 60_000);
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

  const apiUrl = process.env.API_URL?.trim() || "http://localhost:4000";
  const headers: Record<string, string> = { Accept: "application/json" };
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (internalKey) headers.Authorization = `Bearer ${internalKey}`;

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/compliance/export?email=${encodeURIComponent(email)}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Your data export is temporarily unavailable." },
        { status: response.status === 404 ? 404 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Disposition": 'attachment; filename="my-account-data.json"',
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Your data export is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
