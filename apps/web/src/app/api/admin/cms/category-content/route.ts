import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCmsCategoryContentResponseSchema, adminCmsCategoryContentsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/cms/category-content", adminCmsCategoryContentsResponseSchema);
}

export async function POST(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/cms/category-content", adminCmsCategoryContentResponseSchema);
}
