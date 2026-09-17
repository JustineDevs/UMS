import { NextResponse } from "next/server";
import { withBotIdProtection } from "@/lib/botid-protection";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

async function handler(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/back-in-stock`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: await request.clone().text(), cache: "no-store" });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 }); }
}
export const POST = withBotIdProtection(handler);
