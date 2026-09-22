import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { adminCommerceProductSearchResponseSchema } from "@/lib/admin-api-contracts";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const can =
    staffSessionAllows(session, "catalog:read") ||
    staffSessionAllows(session, "content:read") ||
    staffSessionAllows(session, "pos:use");
  if (!can) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const result = await fetchWorkerCatalogProductsForAdmin({ limit: 30, offset: 0, q });
    if (result.commerceUnavailable) {
      return correlatedJson(cid, { error: "Store catalog request unavailable" }, { status: 502 });
    }
    const response = {
      data: {
        products: result.products.map((product) => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          status: product.status,
          thumbnail: product.thumbnail,
          variants: product.variants,
          categories: product.categories,
        })),
        count: result.count,
      },
    };
    const parsed = adminCommerceProductSearchResponseSchema.safeParse(response);
    if (!parsed.success) return correlatedError(cid, 502, "Store catalog returned an invalid search response", "SERVICE_UNAVAILABLE");
    return correlatedJson(cid, parsed.data);
    } catch {
    return correlatedJson(
      cid,
      { error: "Store catalog request unavailable", code: "CATALOG_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
