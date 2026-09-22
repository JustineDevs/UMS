import { NextRequest } from "next/server";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { fetchWorkerCmsBlogsForAdmin, saveWorkerCmsBlogForAdmin } from "@/lib/worker-admin-bridge";

export async function GET(req: NextRequest) {
  const response = await fetchWorkerCmsBlogsForAdmin();
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const body = await parseBoundedJson(req, 512 * 1024);
  if (body.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  if (!body.valid || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) return correlatedJson(correlationId, { error: "Invalid blog payload" }, { status: 400 });
  const response = await saveWorkerCmsBlogForAdmin({ body: body.value as Record<string, unknown>, idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "" });
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}
