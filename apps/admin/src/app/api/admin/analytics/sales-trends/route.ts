import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { fetchCanonicalSalesTrends } from "@/lib/analytics-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "analytics:read")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  const months = Number(req.nextUrl.searchParams.get("months") ?? "6");
  const data = await fetchCanonicalSalesTrends(months);
  return correlatedJson(cid, { data });
}
