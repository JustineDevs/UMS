import { NextRequest } from "next/server";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { deleteWorkerCmsBlogForAdmin, fetchWorkerCmsBlogDetailForAdmin, saveWorkerCmsBlogForAdmin } from "@/lib/worker-admin-bridge";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const response = await fetchWorkerCmsBlogDetailForAdmin(id);
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const correlationId = getCorrelationId(req);
  const [{ id }, body] = await Promise.all([ctx.params, parseBoundedJson(req, 512 * 1024)]);
  if (body.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  if (!body.valid || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) return correlatedJson(correlationId, { error: "Invalid blog payload" }, { status: 400 });
  const response = await saveWorkerCmsBlogForAdmin({ blogId: id, body: body.value as Record<string, unknown>, idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "" });
  return response ?? correlatedJson(correlationId, { error: "Worker backend is unavailable" }, { status: 503 });
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const response = await deleteWorkerCmsBlogForAdmin(id, req.headers.get("idempotency-key")?.trim() ?? "");
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}
