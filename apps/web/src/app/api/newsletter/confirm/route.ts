import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!apiUrl) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/newsletter/confirm?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
