import { fetchWorkerCampaignsForAdmin, mutateWorkerCampaignForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
export const dynamic = "force-dynamic";
const fallback = (id: string) => new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: id }), { status: 503 });
export async function GET(request: Request) { const id = getCorrelationId(request); return await fetchWorkerCampaignsForAdmin(new URL(request.url).searchParams.toString()) ?? fallback(id); }
export async function POST(request: Request) { const id = getCorrelationId(request); const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId: id }), { status: 400 }); let body: Record<string, unknown>; try { body = JSON.parse(await request.text()) as Record<string, unknown>; } catch { return new Response(JSON.stringify({ error: "Invalid JSON", requestId: id }), { status: 400 }); } return await mutateWorkerCampaignForAdmin("/api/admin/campaigns", "POST", body, key) ?? fallback(id); }
