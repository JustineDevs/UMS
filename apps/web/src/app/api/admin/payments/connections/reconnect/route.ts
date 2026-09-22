import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminNangoMutationResponseSchema } from "@/lib/admin-api-contracts";

export function POST(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/payments/connections/reconnect", adminNangoMutationResponseSchema);
}
