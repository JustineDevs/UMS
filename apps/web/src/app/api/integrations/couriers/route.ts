import { COURIER_REGISTRY } from "@/lib/courier-registry";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { integrationsCouriersResponseSchema } from "@/lib/admin-api-contracts";

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
  const parsed = integrationsCouriersResponseSchema.safeParse({ couriers: COURIER_REGISTRY });
  if (!parsed.success) return correlatedJson(correlationId, { error: "Courier registry is invalid", code: "COURIER_REGISTRY_INVALID" }, { status: 503 });
  return correlatedJson(correlationId, parsed.data);
}
