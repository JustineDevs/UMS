import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { fetchCanonicalCustomerClv } from "@/lib/analytics-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "analytics:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return correlatedJson(cid, { error: "email query param required" }, { status: 400 });
  }
  const clv = await fetchCanonicalCustomerClv(email);
  if (!clv) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  return correlatedJson(cid, { data: clv });
}
