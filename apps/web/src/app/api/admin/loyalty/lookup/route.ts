import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminLoyaltyLookupForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: loyalty:read. Global loyalty dataset; source table has no organization column. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const query = new URL(request.url).searchParams.toString();
  const response = await fetchWorkerAdminLoyaltyLookupForAdmin(query);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
