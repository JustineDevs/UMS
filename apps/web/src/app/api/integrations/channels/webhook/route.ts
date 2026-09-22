import { proxyWorkerPublicRoute } from "@/lib/worker-public-route-proxy";
import { adminChannelWebhookResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyWorkerPublicRoute(request, "/api/integrations/channels/webhook", adminChannelWebhookResponseSchema);
}
