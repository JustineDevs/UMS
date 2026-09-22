import { NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { readResponseJson } from "@/lib/read-response-json";
import { accountPrivacyExportResponseSchema } from "@/lib/admin-api-contracts";

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

  const apiUrl = process.env.API_URL?.trim() || "http://localhost:8787";
  const headers: Record<string, string> = { Accept: "application/json" };
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (internalKey) headers["X-Internal-API-Key"] = internalKey;

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
    const data = await readResponseJson(response, { error: "invalid_worker_response" });
    const parsed = accountPrivacyExportResponseSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: "Your data export returned an invalid response." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(parsed.data, {
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
