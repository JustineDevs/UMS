import { NextRequest } from "next/server";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { fetchWorkerCmsFormSubmissionsExportForAdmin } from "@/lib/worker-admin-bridge";

// text/csv raw response is produced by the Worker boundary.

export async function GET(req: NextRequest) {
  const response = await fetchWorkerCmsFormSubmissionsExportForAdmin(req.nextUrl.searchParams.toString());
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}
