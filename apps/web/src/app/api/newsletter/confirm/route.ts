import { NextResponse } from "next/server";
import { readResponseJson } from "@/lib/read-response-json";
import { newsletterConfirmResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!apiUrl) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/newsletter/confirm?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!upstream.ok) return NextResponse.json({ error: "Newsletter confirmation failed" }, { status: upstream.status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    const payload = await readResponseJson<unknown>(upstream, { error: "Newsletter confirmation returned an invalid response" });
    const parsed = newsletterConfirmResponseSchema.safeParse(payload);
    if (!parsed.success) return Response.json({ error: "Newsletter confirmation returned an invalid response" }, { status: 502, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    return Response.json(parsed.data, { status: 200, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return NextResponse.json({ error: "Service unavailable" }, { status: 503 }); }
}
