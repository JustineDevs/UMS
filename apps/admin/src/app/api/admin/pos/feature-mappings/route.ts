import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { POS_FEATURE_MAPPINGS } from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { staffSessionAllows } from "@universal-music-store/database";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:use")) return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  return correlatedJson(correlationId, { data: POS_FEATURE_MAPPINGS });
}
