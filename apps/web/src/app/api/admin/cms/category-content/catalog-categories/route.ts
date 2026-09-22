import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCatalogCategoriesResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/catalog/categories", adminCatalogCategoriesResponseSchema);
}
