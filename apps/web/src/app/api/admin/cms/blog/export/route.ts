import { NextRequest } from "next/server";
import { correlatedJson } from "@/lib/staff-api-response";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerCmsBlogExportForAdmin } from "@/lib/worker-admin-bridge";

// text/csv raw response is produced by the Worker boundary.

export async function GET(req: NextRequest) {
  const rawIds = req.nextUrl.searchParams.get("ids");
  if (rawIds && (rawIds.length > 4096 || rawIds.split(",").length > 100)) {
    return correlatedJson(getCorrelationId(req), { error: "Invalid ids" }, { status: 400 });
  }
  const response = await fetchWorkerCmsBlogExportForAdmin(req.nextUrl.searchParams.toString());
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}
