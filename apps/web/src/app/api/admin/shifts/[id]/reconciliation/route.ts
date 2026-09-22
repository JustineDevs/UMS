import { fetchWorkerPosShiftReconciliationForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; return await fetchWorkerPosShiftReconciliationForAdmin(id) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: getCorrelationId(request) }), { status: 503 }); }
