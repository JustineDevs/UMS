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
import { cmsPreviewResponseSchema } from "@/lib/admin-api-contracts";

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
  const organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  if (!slug?.trim() || !token?.trim()) {
    return Response.json({ error: "slug and token required" }, { status: 400 });
  }
  if (!organizationId) {
    return Response.json({ error: "Preview is not configured" }, { status: 503 });
  }
  let sb: ReturnType<typeof createSupabaseClient>;
  try {
    sb = createSupabaseClient();
  } catch {
    return Response.json({ error: "Server configuration" }, { status: 503 });
  }
  if (kind === "blog") {
    const row = await getCmsBlogPostBySlugPreview(sb, slug, locale, token, organizationId);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const payload = { kind: "blog" as const, data: row };
    const parsed = cmsPreviewResponseSchema.safeParse(payload);
    if (!parsed.success) return Response.json({ error: "Preview returned an invalid response" }, { status: 502 });
    return Response.json(parsed.data);
  }
  const row = await getCmsPageBySlugPreview(sb, slug, locale, token, organizationId);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const payload = { kind: "page" as const, data: row };
  const parsed = cmsPreviewResponseSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Preview returned an invalid response" }, { status: 502 });
  return Response.json(parsed.data);
}
