import { NextRequest } from "next/server";
import { incrementCmsAnnouncementMetric } from "@universal-music-store/platform-data";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { isSameOriginMutation } from "@/lib/request-origin";
import { cmsAnnouncementTrackSchema } from "@/lib/admin-api-contracts";
import { simpleOkResponseSchema } from "@/lib/admin-api-contracts";

const ALLOWED = new Set(["impression", "click", "dismiss"]);

async function handlePOST(req: NextRequest) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`cms-announcement-track:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: rl.retryAfterSec }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfterSec),
      },
    });
  }

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return new Response(JSON.stringify({ ok: false }), { status: 503 });
  }
  const parsedBody = await parseBoundedJson(req, 8 * 1024);
  if (parsedBody.tooLarge) return new Response(JSON.stringify({ error: "Request body is too large" }), { status: 413 });
  if (!parsedBody.valid || !parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const parsed = cmsAnnouncementTrackSchema.safeParse(parsedBody.value);
  if (!parsed.success || !ALLOWED.has(parsed.data.metric)) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
  const { id, locale, metric: metricRaw } = parsed.data;
  const metric =
    metricRaw === "impression"
      ? "impressions"
      : metricRaw === "click"
        ? "clicks"
        : "dismisses";
  await incrementCmsAnnouncementMetric(sb, id, locale, metric);
  return Response.json(simpleOkResponseSchema.parse({ ok: true }));
}

export const POST = withBotIdProtection(handlePOST);
