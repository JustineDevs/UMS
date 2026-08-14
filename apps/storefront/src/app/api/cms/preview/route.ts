import { NextRequest } from "next/server";
import {
  createSupabaseClient,
  getCmsBlogPostBySlugPreview,
  getCmsPageBySlugPreview,
} from "@universal-music-store/platform-data";

import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";

export async function GET(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`cms-preview:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const slug = req.nextUrl.searchParams.get("slug");
  const locale = req.nextUrl.searchParams.get("locale") ?? "en";
  const token = req.nextUrl.searchParams.get("token");
  const kind = req.nextUrl.searchParams.get("kind") ?? "page";
  if (!slug?.trim() || !token?.trim()) {
    return Response.json({ error: "slug and token required" }, { status: 400 });
  }
  let sb: ReturnType<typeof createSupabaseClient>;
  try {
    sb = createSupabaseClient();
  } catch {
    return Response.json({ error: "Server configuration" }, { status: 503 });
  }
  if (kind === "blog") {
    const row = await getCmsBlogPostBySlugPreview(sb, slug, locale, token);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ kind: "blog", data: row });
  }
  const row = await getCmsPageBySlugPreview(sb, slug, locale, token);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ kind: "page", data: row });
}
