import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminPaymentsForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: dashboard:read. Payment attempts are organization-scoped in the Worker. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const query = new URL(request.url).searchParams.toString();
  const response = await fetchWorkerAdminPaymentsForAdmin(query);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
