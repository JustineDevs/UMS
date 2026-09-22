import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCrmBridgeMutationResponseSchema, adminCrmBridgeResponseSchema } from "@/lib/admin-api-contracts";

export async function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/crm/bridge", adminCrmBridgeResponseSchema);
}

export async function POST(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/crm/bridge", adminCrmBridgeMutationResponseSchema);
}
