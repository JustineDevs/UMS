import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerPosProducts, flattenWorkerPosProducts } from "@/lib/pos-worker-catalog";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { posCommerceSearchResponseSchema } from "@/lib/admin-api-contracts";

const DEFAULT_LIMIT = 24;

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length > 200) return correlatedError(correlationId, 400, "Search query is too long", "BAD_REQUEST");
  if (!q) {
    return correlatedJson(correlationId, { products: [] });
  }

  logAdminApiEvent({
    route: "GET /api/pos/commerce/search",
    correlationId,
    phase: "start",
  });

  try {
    const list = flattenWorkerPosProducts(
      await fetchWorkerPosProducts({ query: q, limit: DEFAULT_LIMIT }),
    );

    logAdminApiEvent({
      route: "GET /api/pos/commerce/search",
      correlationId,
      phase: "ok",
      detail: { count: list.length },
    });

    const parsed = posCommerceSearchResponseSchema.safeParse({ products: list });
    if (!parsed.success) return correlatedError(correlationId, 502, "Product search response is invalid", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Product search unavailable";
    logAdminApiEvent({
      route: "GET /api/pos/commerce/search",
      correlationId,
      phase: "error",
      detail: { message: msg },
    });
    return correlatedError(correlationId, 502, "Product search is unavailable", "SERVICE_UNAVAILABLE");
  }
}
