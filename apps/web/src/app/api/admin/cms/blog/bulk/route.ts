import { NextRequest } from "next/server";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { bulkDeleteWorkerCmsBlogsForAdmin } from "@/lib/worker-admin-bridge";

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const body = await parseBoundedJson(req, 32 * 1024);
  if (body.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  if (!body.valid || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) return correlatedJson(correlationId, { error: "Invalid blog bulk payload" }, { status: 400 });
  const value = body.value as { ids?: unknown };
  if (!Array.isArray(value.ids)) return correlatedJson(correlationId, { error: "Invalid blog bulk payload" }, { status: 400 });
  const response = await bulkDeleteWorkerCmsBlogsForAdmin(value.ids.filter((id): id is string => typeof id === "string"), req.headers.get("idempotency-key")?.trim() ?? "");
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}
