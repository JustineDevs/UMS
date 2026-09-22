import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerOfflineQueueForAdmin, saveWorkerOfflineQueueForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

/** Worker auth: pos:use. Queue reads and mutations are organization-scoped in the Worker. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const query = new URL(request.url).searchParams.toString();
  const response = await fetchWorkerOfflineQueueForAdmin(query);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}

async function mutate(request: Request, method: "POST" | "PATCH") {
  const correlationId = getCorrelationId(request);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId: correlationId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256 * 1024) return new Response(JSON.stringify({ error: "Payload too large", requestId: correlationId }), { status: 413, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
  let body: Record<string, unknown>;
  try { const text = await request.text(); if (text.length > 256 * 1024) return new Response(JSON.stringify({ error: "Payload too large", requestId: correlationId }), { status: 413, headers: { "Content-Type": "application/json", "x-request-id": correlationId } }); body = JSON.parse(text) as Record<string, unknown>; } catch { return new Response(JSON.stringify({ error: "Invalid JSON body", requestId: correlationId }), { status: 400, headers: { "Content-Type": "application/json", "x-request-id": correlationId } }); }
  const response = await saveWorkerOfflineQueueForAdmin(method, body, idempotencyKey);
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}

export async function POST(request: Request) { return mutate(request, "POST"); }
export async function PATCH(request: Request) { return mutate(request, "PATCH"); }
