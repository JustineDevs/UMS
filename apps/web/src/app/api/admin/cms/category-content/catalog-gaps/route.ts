import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCmsCategoryGapsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/cms/category-content/catalog-gaps", adminCmsCategoryGapsResponseSchema);
}
