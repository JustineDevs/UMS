import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/newsletter/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.clone().text(), cache: "no-store" });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
