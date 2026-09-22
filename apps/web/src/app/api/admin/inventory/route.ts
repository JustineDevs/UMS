import { fetchWorkerInventoryPage } from "@/lib/worker-admin-bridge";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { requireStaffSessionWithPermission } from "@/lib/requireStaffSession";
import { buildAdminPagination } from "@/lib/admin-pagination";
import { adminInventoryResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZES = new Set([25, 50, 100]);

function parseInventoryQuery(req: Request): { page: number; pageSize: number } {
  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sizeRaw = Number(url.searchParams.get("pageSize") ?? "25");
  const pageSize = ALLOWED_PAGE_SIZES.has(sizeRaw) ? sizeRaw : 25;
  return { page, pageSize };
}

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffSessionWithPermission("inventory:read");
  if (!staff.ok) {
    logAdminApiEvent({
      route: "GET /api/admin/inventory",
      correlationId,
      phase: "error",
      detail: { code: "unauthorized" },
    });
    return tagResponse(staff.response, correlationId);
  }

  const { page, pageSize } = parseInventoryQuery(req);
  const offset = (page - 1) * pageSize;

  logAdminApiEvent({
    route: "GET /api/admin/inventory",
    correlationId,
    phase: "start",
    detail: { page, pageSize },
  });

  const result = await fetchWorkerInventoryPage({ limit: pageSize, offset });
  logAdminApiEvent({
    route: "GET /api/admin/inventory",
    correlationId,
    phase: "ok",
    detail: { rowCount: result.rows.length, total: result.total },
  });

  const response = {
    rows: result.rows,
    ...buildAdminPagination(page, pageSize, result.total),
  };
  const parsed = adminInventoryResponseSchema.safeParse(response);
  if (!parsed.success) return correlatedError(correlationId, 502, "Inventory response is invalid", "SERVICE_UNAVAILABLE");
  return correlatedJson(correlationId, parsed.data);
}
