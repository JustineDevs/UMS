import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerRuntimeSettingsForAdmin, saveWorkerRuntimeSettingsForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: settings:read for GET and settings:write plus Idempotency-Key for PUT. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerRuntimeSettingsForAdmin();
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}

export async function PUT(request: Request) {
  const correlationId = getCorrelationId(request);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId: correlationId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return new Response(JSON.stringify({ error: "Invalid JSON body", requestId: correlationId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": correlationId } }); }
  const response = await saveWorkerRuntimeSettingsForAdmin(body, idempotencyKey);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
