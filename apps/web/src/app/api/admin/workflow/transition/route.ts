import { mutateWorkerWorkflowTransitionForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getCorrelationId(request);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });
  const parsed = await parseBoundedJson(request, 32 * 1024);
  if (parsed.tooLarge) return new Response(JSON.stringify({ error: "Payload too large", requestId }), { status: 413, headers: { "Content-Type": "application/json" } });
  if (!parsed.valid) return new Response(JSON.stringify({ error: "Invalid JSON", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return new Response(JSON.stringify({ error: "Invalid payload", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });
  return await mutateWorkerWorkflowTransitionForAdmin(body as Record<string, unknown>, key) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503, headers: { "Content-Type": "application/json" } });
}
