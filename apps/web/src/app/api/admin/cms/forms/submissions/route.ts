import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerCmsFormSubmissionsForAdmin } from "@/lib/worker-admin-bridge";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { const requestId = getCorrelationId(request); const query = new URL(request.url).searchParams.toString(); const response = await fetchWorkerCmsFormSubmissionsForAdmin(query); return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": requestId } }); }
