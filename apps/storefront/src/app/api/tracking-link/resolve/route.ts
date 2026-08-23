import { NextResponse } from "next/server";
import { resolveTrackingPath } from "@/lib/tracking-link-resolve";

export const dynamic = "force-dynamic";
const MAX_TRACKING_FORM_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_TRACKING_FORM_BYTES) {
    return NextResponse.json(
      { error: "Tracking link input is too large" },
      { status: 413, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
    );
  }
  const body = await request.formData().catch(() => null);
  const raw = body?.get("trackingUrl");
  const path = typeof raw === "string" ? resolveTrackingPath(raw.trim(), request.url) : null;
  if (!path) {
    return NextResponse.json({ error: "Enter a complete secure tracking link" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.redirect(new URL(path, request.url), { status: 303, headers: { "Cache-Control": "no-store" } });
}
