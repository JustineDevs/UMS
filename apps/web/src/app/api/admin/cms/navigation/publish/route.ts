import { NextRequest } from "next/server";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { publishWorkerCmsNavigationForAdmin } from "@/lib/worker-admin-bridge";

export async function POST(req: NextRequest) {
  const response = await publishWorkerCmsNavigationForAdmin(req.headers.get("idempotency-key")?.trim() ?? "");
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}
