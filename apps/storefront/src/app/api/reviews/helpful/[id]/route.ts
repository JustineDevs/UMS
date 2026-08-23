import { getStorefrontSession } from "@/lib/auth";
import {
  createStorefrontServiceSupabase,
} from "@/lib/storefront-supabase";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { findOrCreateMedusaCustomerIdByEmail } from "@/lib/medusa-customer-resolve";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isReviewId } from "@/lib/review-api-contract";

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

  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();

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

  let customerId: string | null = null;
  if (email) {
    customerId = await findOrCreateMedusaCustomerIdByEmail(email).catch(() => null);
  }

  const { data: voteResult, error: voteError } = await sb.rpc(
    "record_review_helpful_vote",
    { review_uuid: reviewId, customer_id: customerId, request_ip: ip },
  );
  if (voteError) {
    console.error("[review-helpful] record error:", voteError);
    return Response.json({ error: "Unable to record vote" }, { status: 503 });
  }
  const result = Array.isArray(voteResult) ? voteResult[0] : voteResult;
  if (!result || result.inserted !== true) {
    return Response.json({ error: "Already voted", code: "ALREADY_VOTED" }, { status: 409 });
  }

  return Response.json({ ok: true, helpful_votes: result.helpful_votes });
}
