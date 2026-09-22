import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminInventoryReservationResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  if (!id?.trim()) return Response.json({ error: "reservation_not_found" }, { status: 404 });
  return proxyWorkerAdminRoute(
    request,
    `/api/admin/inventory/reservations/${encodeURIComponent(id)}`,
    adminInventoryReservationResponseSchema,
  );
}
