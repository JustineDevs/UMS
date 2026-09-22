import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminNangoConnectionsResponseSchema, adminNangoMutationResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/crm/nango", adminNangoConnectionsResponseSchema);
}

export function POST(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/crm/nango", adminNangoMutationResponseSchema);
}

export function DELETE(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/crm/nango", adminNangoMutationResponseSchema);
}
