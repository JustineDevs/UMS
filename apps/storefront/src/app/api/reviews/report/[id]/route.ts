import { getStorefrontSession } from "@/lib/auth";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isReviewId, reviewReportBodySchema } from "@/lib/review-api-contract";
import { readBoundedRequestBody } from "@/lib/bounded-request-body";
import { reviewCsrfCookieName, verifyReviewCsrfToken } from "@/lib/review-csrf";
import { reviewModerationResult } from "@/lib/review-report-moderation";

const MAX_REPORT_BODY_BYTES = 8 * 1024;

function reportResponse(body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) {
    return reportResponse({ error: "Cross-site mutation rejected" }, 403);
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`review-report:${ip}`, 10, 60_000);
  if (!rl.ok) return reportResponse({ error: "Too many requests" }, 429);
  const id = (await params).id?.trim();
  const session = await getStorefrontSession();
  if (!id || !session?.user?.email) return reportResponse({ error: "Sign in required" }, 401);
  if (!isReviewId(id)) {
    return reportResponse({ error: "Invalid review" }, 400);
  }
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BODY_BYTES) {
    return reportResponse({ error: "Request body too large" }, 413);
  }
  const { body: rawBody, tooLarge } = await readBoundedRequestBody(req, MAX_REPORT_BODY_BYTES);
  if (tooLarge) {
    return reportResponse({ error: "Request body too large" }, 413);
  }
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody || "null");
  } catch {
    body = null;
  }
  const parsed = reviewReportBodySchema.safeParse(body);
  if (!parsed.success) return reportResponse({ error: "Invalid report" }, 400);
  const csrfCookie = req.headers.get("cookie")?.match(new RegExp(`${reviewCsrfCookieName()}=([^;]+)`))?.[1];
  if (!verifyReviewCsrfToken(parsed.data.csrfToken, csrfCookie)) {
    return reportResponse({ error: "Security token expired. Reload and try again." }, 403);
  }
  const sb = createStorefrontServiceSupabase();
  if (!sb) return reportResponse({ error: "Service unavailable" }, 503);
  const { data: review } = await sb
    .from("product_reviews")
    .select("id")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!review) return reportResponse({ error: "Review not found" }, 404);
  const { error } = await sb.from("product_review_reports").insert({
    review_id: id,
    reporter_email: session.user.email.trim().toLowerCase(),
    reporter_ip: ip,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return reportResponse({ error: "Already reported" }, 409);
    return reportResponse({ error: "Unable to record report" }, 503);
  }
  const { count, error: countError } = await sb
    .from("product_review_reports")
    .select("id", { count: "exact", head: true })
    .eq("review_id", id)
    .eq("status", "open");
  let hideFailed = false;
  if ((count ?? 0) >= 3 && !countError) {
    const { error: moderationError } = await sb
      .from("product_reviews")
      .update({ status: "hidden" })
      .eq("id", id)
      .eq("status", "approved");
    hideFailed = Boolean(moderationError);
  }
  const moderationResult = reviewModerationResult({
    openReportCount: count,
    countFailed: Boolean(countError),
    hideFailed,
  });
  return reportResponse(moderationResult.body, moderationResult.status);
}
