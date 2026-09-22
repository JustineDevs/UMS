import { PLATFORM_FEATURE_MAPPINGS, buildPlatformFeatureMappingMetadata } from "@universal-music-store/platform-data";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { NextRequest } from "next/server";
import { adminFeatureMappingsResponseSchema } from "@/lib/admin-api-contracts";

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "dashboard:read")) return correlatedError(correlationId, 403, "Forbidden", "FORBIDDEN");
  const response = {
    data: buildPlatformFeatureMappingMetadata(),
    generatedAt: new Date().toISOString(),
    count: PLATFORM_FEATURE_MAPPINGS.length,
  };
  const parsed = adminFeatureMappingsResponseSchema.safeParse(response);
  if (!parsed.success) return correlatedError(correlationId, 500, "Feature mapping response is invalid", "INTERNAL_ERROR");
  return correlatedJson(correlationId, parsed.data);
}
