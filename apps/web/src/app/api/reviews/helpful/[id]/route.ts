import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isReviewId } from "@/lib/review-api-contract";
import { proxyWorkerStorefrontRoute } from "@/lib/worker-storefront-route-proxy";
import { reviewHelpfulResponseSchema } from "@/lib/admin-api-contracts";

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

  const reviewId = (await params).id?.trim();
  if (!reviewId || !isReviewId(reviewId)) {
    return Response.json({ error: "Invalid review id" }, { status: 400 });
  }
  return proxyWorkerStorefrontRoute(req, `/store/reviews/${encodeURIComponent(reviewId)}/helpful`, 8 * 1024, reviewHelpfulResponseSchema);
}
