import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminPaymentCapabilitiesForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: settings:read. Provider capabilities and merchant policy are Worker-owned. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerAdminPaymentCapabilitiesForAdmin();
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
