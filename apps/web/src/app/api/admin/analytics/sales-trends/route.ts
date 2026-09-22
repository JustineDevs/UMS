import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError } from "@/lib/staff-api-response";
import { adminAnalyticsSalesTrendsResponseSchema } from "@/lib/admin-api-contracts";
import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "analytics:read")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  try {
    const response = await proxyWorkerAdminRoute(req, "/api/admin/analytics/sales-trends", adminAnalyticsSalesTrendsResponseSchema);
    const headers = new Headers(response.headers);
    headers.set("x-request-id", cid);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return correlatedError(cid, 503, "Analytics service is unavailable", "SERVICE_UNAVAILABLE");
  }
}
