import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminReviewsForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: content:read. Global moderation dataset; no organization column exists. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerAdminReviewsForAdmin(new URL(request.url).searchParams.toString());
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
