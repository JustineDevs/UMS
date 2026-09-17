import { getStorefrontSession } from "@/lib/auth";
import {
  createStorefrontServiceSupabase,
} from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isReviewId } from "@/lib/review-api-contract";
import { reviewCsrfCookieName, verifyReviewCsrfToken } from "@/lib/review-csrf";
import { readBoundedRequestBody } from "@/lib/bounded-request-body";

const MAX_VOTE_BODY_BYTES = 2 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`review-helpful:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id: reviewId } = await params;
  if (!reviewId?.trim() || !isReviewId(reviewId)) {
    return Response.json({ error: "Invalid review id" }, { status: 400 });
  }

  const { body: rawBody, tooLarge } = await readBoundedRequestBody(req, MAX_VOTE_BODY_BYTES);
  if (tooLarge) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody || "null");
  } catch {
    body = null;
  }
  const csrfToken =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).csrfToken
      : undefined;
  const csrfCookie = req.headers.get("cookie")?.match(new RegExp(`${reviewCsrfCookieName()}=([^;]+)`))?.[1];
  if (!verifyReviewCsrfToken(csrfToken, csrfCookie)) {
    return Response.json({ error: "Security token expired. Reload and try again." }, { status: 403 });
  }

  const session = await getStorefrontSession();
  const customerId = session?.user?.id?.trim() || null;

  const sb = createStorefrontServiceSupabase();
  if (!sb) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: review } = await sb
    .from("product_reviews")
    .select("id,helpful_votes")
    .eq("id", reviewId)
    .eq("status", "approved")
    .maybeSingle();

  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const { data: voteResult, error: voteError } = await sb.rpc(
    "record_review_helpful_vote",
    { review_uuid: reviewId, customer_id: customerId, request_ip: ip },
  );
  if (voteError) {
    console.error("[review-helpful] record failed", {
      requestId: req.headers.get("x-request-id")?.slice(0, 128) ?? "unknown",
      code: typeof voteError.code === "string" ? voteError.code.slice(0, 32) : "unknown",
    });
    return Response.json(
      { error: "Unable to record vote" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = Array.isArray(voteResult) ? voteResult[0] : voteResult;
  if (!result || result.inserted !== true) {
    return Response.json({ error: "Already voted", code: "ALREADY_VOTED" }, { status: 409 });
  }

  return Response.json({ ok: true, helpful_votes: result.helpful_votes });
}
