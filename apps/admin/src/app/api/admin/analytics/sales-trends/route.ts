import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { fetchCanonicalSalesTrends } from "@/lib/analytics-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "analytics:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const months = Number(req.nextUrl.searchParams.get("months") ?? "6");
  const data = await fetchCanonicalSalesTrends(months);
  return correlatedJson(cid, { data });
}
