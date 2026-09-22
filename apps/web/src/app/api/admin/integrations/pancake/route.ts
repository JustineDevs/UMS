import { NextRequest } from "next/server";
import { adminPancakeIntegrationResponseSchema } from "@/lib/admin-api-contracts";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";

export const dynamic = "force-dynamic";

/** Session-authenticated proxy; provider credentials and Pancake requests live only in the Worker. */
export async function GET(request: NextRequest): Promise<Response> {
  const staff = await requireStaffApiSession("settings:read");
  if (!staff.ok) return staff.response;
  return proxyWorkerAdminRoute(request, "/api/admin/integrations/pancake", adminPancakeIntegrationResponseSchema);
}
