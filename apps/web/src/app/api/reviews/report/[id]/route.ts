import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { isReviewId } from "@/lib/review-api-contract";
import { proxyWorkerStorefrontRoute } from "@/lib/worker-storefront-route-proxy";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`review-report:${ip}`, 10, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  const id = (await params).id?.trim();
  if (!id || !isReviewId(id)) return Response.json({ error: "Invalid review" }, { status: 400 });
  return proxyWorkerStorefrontRoute(req, `/store/reviews/${encodeURIComponent(id)}/report`);
}
