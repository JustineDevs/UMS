import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { adminCatalogProductSuggestionsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
  }
  if (
    !staffSessionAllows(session, "catalog:read") &&
    !staffSessionAllows(session, "catalog:write")
  ) {
    return correlatedError(correlationId, 403, "Forbidden", "FORBIDDEN");
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  try {
    const result = await fetchWorkerCatalogProductsForAdmin({ limit: 30, offset: 0, q });
    if (result.commerceUnavailable) {
      return correlatedError(
        correlationId,
        503,
        "Store catalog request unavailable",
        "SERVICE_UNAVAILABLE",
      );
    }
    const items = result.products.flatMap((p) => {
      const item = {
        id: p.id,
        title: p.title.trim() || "(untitled)",
        handle: p.handle.trim(),
      };
      return item.id && item.handle ? [item] : [];
    });
    const parsed = adminCatalogProductSuggestionsResponseSchema.safeParse({ items });
    if (!parsed.success) return correlatedError(correlationId, 502, "Store catalog returned an invalid suggestion response", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, parsed.data);
  } catch {
    return correlatedError(correlationId, 502, "Store catalog request unavailable", "SERVICE_UNAVAILABLE");
  }
}
