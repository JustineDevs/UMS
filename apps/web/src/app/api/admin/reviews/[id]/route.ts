import { getCorrelationId } from "@/lib/request-correlation";
import { saveWorkerAdminReviewForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getCorrelationId(request); const { id } = await context.params; const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": requestId } });
  const length = Number(request.headers.get("content-length") ?? 0); if (length > 128 * 1024) return new Response(JSON.stringify({ error: "Payload too large", requestId }), { status: 413, headers: { "Content-Type": "application/json", "x-request-id": requestId } });
  let body: Record<string, unknown>; try { const text = await request.text(); if (text.length > 128 * 1024) throw new Error("payload_too_large"); const parsed = JSON.parse(text) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_payload"); body = parsed as Record<string, unknown>; } catch (error) { const status = error instanceof Error && error.message === "payload_too_large" ? 413 : 400; return new Response(JSON.stringify({ error: status === 413 ? "Payload too large" : "Invalid JSON body", requestId }), { status, headers: { "Content-Type": "application/json", "x-request-id": requestId } }); }
  const response = await saveWorkerAdminReviewForAdmin(id, body, key); return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": requestId } });
}
