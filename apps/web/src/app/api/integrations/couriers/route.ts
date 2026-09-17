import { COURIER_REGISTRY } from "@/lib/courier-registry";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffSession();
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }
  logAdminApiEvent({
    route: "GET /api/integrations/couriers",
    correlationId,
    phase: "ok",
    detail: { count: COURIER_REGISTRY.length },
  });
  return correlatedJson(correlationId, { couriers: COURIER_REGISTRY });
}
