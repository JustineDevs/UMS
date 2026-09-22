import { NextResponse } from "next/server";
import { withBotIdProtection } from "@/lib/botid-protection";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readResponseJson } from "@/lib/read-response-json";
import { simpleOkResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

async function handler(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ error: "Subscription service unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/newsletter`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: await request.clone().text(), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) return NextResponse.json({ error: "Subscription request could not be completed" }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    const payload = await readResponseJson<unknown>(upstream, null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Subscription service returned an invalid response" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    const parsed = simpleOkResponseSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "Subscription service returned an invalid response" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(parsed.data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Subscription service unavailable" }, { status: 503 }); }
}
export const POST = withBotIdProtection(handler);
