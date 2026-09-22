import { mutateWorkerCampaignForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { const requestId = getCorrelationId(request); const { id } = await context.params; const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId }), { status: 400 }); return await mutateWorkerCampaignForAdmin(`/api/admin/campaigns/${encodeURIComponent(id)}/execute`, "POST", {}, key) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503 }); }
