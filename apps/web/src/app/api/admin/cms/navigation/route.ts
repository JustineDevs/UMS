import { NextRequest } from "next/server";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { fetchWorkerCmsNavigationForAdmin, saveWorkerCmsNavigationForAdmin } from "@/lib/worker-admin-bridge";

export async function GET(req: NextRequest) {
  const response = await fetchWorkerCmsNavigationForAdmin();
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function PUT(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const body = await parseBoundedJson(req, 128 * 1024);
  if (body.tooLarge) return correlatedJson(correlationId, { error: "Request body is too large" }, { status: 413 });
  if (!body.valid || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) return correlatedJson(correlationId, { error: "Invalid navigation payload" }, { status: 400 });
  const response = await saveWorkerCmsNavigationForAdmin(body.value as Record<string, unknown>, req.headers.get("idempotency-key")?.trim() ?? "");
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}
