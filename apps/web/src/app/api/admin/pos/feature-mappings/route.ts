import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { POS_FEATURE_MAPPINGS } from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminPosFeatureMappingsResponseSchema } from "@/lib/admin-api-contracts";
import { correlatedError } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:use")) return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  const parsed = adminPosFeatureMappingsResponseSchema.safeParse({ data: POS_FEATURE_MAPPINGS });
  if (!parsed.success) return correlatedError(correlationId, 500, "POS feature mapping response is invalid", "INTERNAL_ERROR");
  return correlatedJson(correlationId, parsed.data);
}
