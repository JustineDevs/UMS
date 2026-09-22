import { fetchWorkerDeliveryOperationsForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { adminDeliveryLogisticsResponseSchema } from "@/lib/admin-api-contracts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { const requestId = getCorrelationId(request); const response = await fetchWorkerDeliveryOperationsForAdmin(); if (!response) return new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503 }); if (!response.ok) return response; try { return new Response(JSON.stringify(adminDeliveryLogisticsResponseSchema.parse(await response.json())), { status: response.status, headers: { "Content-Type": "application/json" } }); } catch { return new Response(JSON.stringify({ error: "Invalid Worker delivery contract", requestId }), { status: 502 }); } }
