import { adminCampaignResponseEnvelopeSchema } from "@/lib/admin-api-contracts";
import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return proxyWorkerAdminRoute(request, `/api/admin/campaigns/${encodeURIComponent(id)}`, adminCampaignResponseEnvelopeSchema);
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return proxyWorkerAdminRoute(request, `/api/admin/campaigns/${encodeURIComponent(id)}`, adminCampaignResponseEnvelopeSchema);
}
