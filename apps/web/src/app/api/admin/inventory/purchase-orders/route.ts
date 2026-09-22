import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyWorkerAdminRoute(request, "/api/admin/inventory/purchase-orders"); }
export async function POST(request: Request) { return proxyWorkerAdminRoute(request, "/api/admin/inventory/purchase-orders"); }
