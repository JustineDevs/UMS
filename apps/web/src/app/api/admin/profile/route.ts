import { getCorrelationId } from "@/lib/request-correlation";
import { saveWorkerAdminProfileForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: settings:write. The Worker scopes the mutation to the verified email claim. */
export async function PATCH(request: Request) {
  const correlationId = getCorrelationId(request);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId: correlationId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return new Response(JSON.stringify({ error: "Invalid JSON body", requestId: correlationId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": correlationId } }); }
  const response = await saveWorkerAdminProfileForAdmin(body, idempotencyKey);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
