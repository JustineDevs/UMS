import { NextRequest } from "next/server";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { correlatedJson } from "@/lib/staff-api-response";
import { getCorrelationId } from "@/lib/request-correlation";
import {
  fetchWorkerCmsPagesForAdmin,
  saveWorkerCmsPageForAdmin,
} from "@/lib/worker-admin-bridge";

export async function GET(req: NextRequest) {
  const response = await fetchWorkerCmsPagesForAdmin({
    locale: req.nextUrl.searchParams.get("locale") ?? undefined,
    slug: req.nextUrl.searchParams.get("slug") ?? undefined,
  });
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const parsed = await parseBoundedJson(req, 512 * 1024);
  if (parsed.tooLarge) return correlatedJson(correlationId, { error: "Request body is too large" }, { status: 413 });
  if (!parsed.valid || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return correlatedJson(correlationId, { error: "Invalid JSON" }, { status: 400 });
  }
  const response = await saveWorkerCmsPageForAdmin({
    body: parsed.value as Record<string, unknown>,
    idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
  });
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}
