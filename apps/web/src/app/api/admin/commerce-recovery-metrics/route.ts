import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerPaymentRecoveryMetricsForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: dashboard:read. Tenant scope: organization_id. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerPaymentRecoveryMetricsForAdmin(new URL(request.url).searchParams.toString());
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
