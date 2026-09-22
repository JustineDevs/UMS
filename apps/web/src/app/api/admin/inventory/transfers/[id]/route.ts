import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { const { id } = await context.params; return proxyWorkerAdminRoute(request, `/api/admin/inventory/transfers/${encodeURIComponent(id)}`); }
export async function POST(request: Request, context: Context) { const { id } = await context.params; return proxyWorkerAdminRoute(request, `/api/admin/inventory/transfers/${encodeURIComponent(id)}`); }
