import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminTrackingCapabilityRevokeResponseSchema } from "@/lib/admin-api-contracts";

export async function POST(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/tracking-capabilities/revoke", adminTrackingCapabilityRevokeResponseSchema);
}
