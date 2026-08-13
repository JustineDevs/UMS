import { PLATFORM_FEATURE_MAPPINGS, buildPlatformFeatureMappingMetadata } from "@universal-music-store/platform-data";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "dashboard:read")) return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  return correlatedJson(correlationId, {
    data: buildPlatformFeatureMappingMetadata(),
    generatedAt: new Date().toISOString(),
    count: PLATFORM_FEATURE_MAPPINGS.length,
  });
}
