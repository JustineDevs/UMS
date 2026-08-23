import { NextRequest } from "next/server";
import { incrementCmsAbExperimentImpressions } from "@universal-music-store/platform-data";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`cms-ab-impression:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsedBody = await parseBoundedJson(req, 8 * 1024);
  if (parsedBody.tooLarge) return Response.json({ error: "Request body is too large" }, { status: 413 });
  if (!parsedBody.valid) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const body: unknown = parsedBody.value;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const rec = body as Record<string, unknown>;
  const experimentKey =
    typeof rec.experiment_key === "string" ? rec.experiment_key.trim() : "";
  const variantId =
    typeof rec.variant_id === "string" ? rec.variant_id.trim() : "";
  if (!experimentKey || !variantId) {
    return Response.json(
      { error: "experiment_key and variant_id required" },
      { status: 400 },
    );
  }

  const svc = createStorefrontServiceSupabase();
  if (!svc) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }

  const ok = await incrementCmsAbExperimentImpressions(svc, experimentKey);
  if (!ok) {
    return Response.json({ error: "Not recorded" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
