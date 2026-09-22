import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminInventoryReservationResponseSchema, adminInventoryReservationsResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/inventory/reservations", adminInventoryReservationsResponseSchema);
}

export function POST(request: Request): Promise<Response> {
  return proxyWorkerAdminRoute(request, "/api/admin/inventory/reservations", adminInventoryReservationResponseSchema);
}
