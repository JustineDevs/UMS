import { NextRequest } from "next/server";
import { correlatedJson } from "@/lib/staff-api-response";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerCmsPageMutationsForAdmin } from "@/lib/worker-admin-bridge";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const response = await fetchWorkerCmsPageMutationsForAdmin(id);
  return response ?? correlatedJson(getCorrelationId(req), { error: "Worker backend is unavailable" }, { status: 503 });
}
