import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerPosProducts, flattenWorkerPosProducts } from "@/lib/pos-worker-catalog";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { posCommerceSuggestionsResponseSchema } from "@/lib/admin-api-contracts";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  try {
    const suggestions = flattenWorkerPosProducts(
      await fetchWorkerPosProducts({ limit: 12 }),
    ).slice(0, 8);

    logAdminApiEvent({
      route: "GET /api/pos/commerce/suggestions",
      correlationId,
      phase: "ok",
      detail: { count: suggestions.length },
    });

    const parsed = posCommerceSuggestionsResponseSchema.safeParse({ suggestions });
    if (!parsed.success) return correlatedError(correlationId, 502, "Product suggestions response is invalid", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, parsed.data);
  } catch {
    return correlatedError(correlationId, 502, "Product suggestions are unavailable", "SERVICE_UNAVAILABLE");
  }
}
