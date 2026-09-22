import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminChannelEventProcessResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyWorkerAdminRoute(
    request,
    `/api/admin/channels/events/${encodeURIComponent(id)}/process`,
    adminChannelEventProcessResponseSchema,
  );
}
