import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminTasksTodayForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerAdminTasksTodayForAdmin();
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
