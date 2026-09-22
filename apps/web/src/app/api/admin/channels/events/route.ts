import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminChannelEventsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/channels/events", adminChannelEventsResponseSchema);
}
