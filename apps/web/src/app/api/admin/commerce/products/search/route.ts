import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

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
    return correlatedJson(cid, {
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
    });
  } catch (e) {
    return correlatedJson(
      cid,
      { error: e instanceof Error ? e.message : "Store catalog request unavailable" },
      { status: 502 },
    );
  }
}
