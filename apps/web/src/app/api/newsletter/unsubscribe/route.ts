import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/request-origin";
import { readResponseJson } from "@/lib/read-response-json";
import { simpleOkResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/newsletter/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.clone().text(), cache: "no-store" });
    if (!upstream.ok) return NextResponse.json({ error: "Newsletter unsubscribe failed" }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    const payload = await readResponseJson<unknown>(upstream, { error: "Newsletter unsubscribe returned an invalid response" });
    const parsed = simpleOkResponseSchema.safeParse(payload);
    if (!parsed.success) return Response.json({ error: "Newsletter unsubscribe returned an invalid response" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return Response.json(parsed.data, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
