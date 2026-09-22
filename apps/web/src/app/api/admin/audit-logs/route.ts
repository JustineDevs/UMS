import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAuditLogsForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/**
 * Staff audit rows (timelines, compliance view, export). The Worker owns the
 * APP database read so tenant filtering and response bounds are enforced once.
 * Worker auth: dashboard:read / analytics:export. Tenant scope: organization_id.
 */
export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const query = new URL(req.url).searchParams.toString();
  const response = await fetchWorkerAuditLogsForAdmin(query);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
