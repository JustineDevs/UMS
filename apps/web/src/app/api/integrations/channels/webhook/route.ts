import { proxyWorkerPublicRoute } from "@/lib/worker-public-route-proxy";
import { adminChannelWebhookResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  // Signature verification is intentionally owned by the Worker boundary;
  // this same-origin route forwards the signed request without rewriting it.
  return proxyWorkerPublicRoute(request, "/api/integrations/channels/webhook", adminChannelWebhookResponseSchema);
}
