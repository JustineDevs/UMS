import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminRolesForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: employees:read. Global staff-policy dataset; no organization column exists. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerAdminRolesForAdmin();
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
