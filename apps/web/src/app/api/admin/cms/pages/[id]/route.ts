import { NextRequest } from "next/server";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { correlatedJson } from "@/lib/staff-api-response";
import { getCorrelationId } from "@/lib/request-correlation";
import {
  deleteWorkerCmsPageForAdmin,
  fetchWorkerCmsPageDetailForAdmin,
  saveWorkerCmsPageForAdmin,
} from "@/lib/worker-admin-bridge";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const response = await fetchWorkerCmsPageDetailForAdmin(id);
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const correlationId = getCorrelationId(req);
  const [{ id }, parsed] = await Promise.all([
    ctx.params,
    parseBoundedJson(req, 512 * 1024),
  ]);
  if (parsed.tooLarge) return correlatedJson(correlationId, { error: "Request body is too large" }, { status: 413 });
  if (!parsed.valid || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return correlatedJson(correlationId, { error: "Invalid JSON" }, { status: 400 });
  }
  const response = await saveWorkerCmsPageForAdmin({
    pageId: id,
    body: parsed.value as Record<string, unknown>,
    idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
  });
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const correlationId = getCorrelationId(req);
  const { id } = await ctx.params;
  const response = await deleteWorkerCmsPageForAdmin(id, req.headers.get("idempotency-key")?.trim() ?? "");
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}
