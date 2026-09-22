import { NextRequest } from "next/server";
import { correlatedJson } from "@/lib/staff-api-response";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerPaymentHealthForAdmin } from "@/lib/worker-admin-bridge";

export async function GET(req: NextRequest) {
  const response = await fetchWorkerPaymentHealthForAdmin();
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}
