import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerPosProducts, mapWorkerPosVariant } from "@/lib/pos-worker-catalog";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { posCommerceQuickProductsResponseSchema } from "@/lib/admin-api-contracts";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  logAdminApiEvent({
    route: "GET /api/pos/commerce/quick-products",
    correlationId,
    phase: "start",
  });

  try {
    const products = await fetchWorkerPosProducts({ limit: 4 });
    const list = products.flatMap((product) => {
      const variant = product.variants?.[0];
      const mapped = variant ? mapWorkerPosVariant(product, variant) : null;
      return mapped ? [mapped] : [];
    });

    logAdminApiEvent({
      route: "GET /api/pos/commerce/quick-products",
      correlationId,
      phase: "ok",
      detail: { count: list.length },
    });

    const parsed = posCommerceQuickProductsResponseSchema.safeParse({ products: list });
    if (!parsed.success) return correlatedError(correlationId, 502, "Quick product response is invalid", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Quick products unavailable";
    logAdminApiEvent({
      route: "GET /api/pos/commerce/quick-products",
      correlationId,
      phase: "error",
      detail: { message: msg },
    });
    return correlatedError(correlationId, 502, "Quick product lookup is unavailable", "SERVICE_UNAVAILABLE");
  }
}
