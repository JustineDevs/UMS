import { fetchWorkerVoidsForAdmin, mutateWorkerVoidForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { adminVoidRequestSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url); const params = new URLSearchParams();
  for (const name of ["shift_id", "limit"]) { const value = url.searchParams.get(name)?.trim(); if (value) params.set(name, value); }
  return await fetchWorkerVoidsForAdmin(params.toString() ? `?${params}` : "") ?? new Response(JSON.stringify({ error: "Worker backend is unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
}

export async function POST(request: Request) {
  const requestId = getCorrelationId(request); const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });
  const parsed = await parseBoundedJson(request, 32 * 1024);
  if (parsed.tooLarge) return new Response(JSON.stringify({ error: "Payload too large", requestId }), { status: 413, headers: { "Content-Type": "application/json" } });
  if (!parsed.valid || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return new Response(JSON.stringify({ error: "Invalid JSON", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });
  const validated = adminVoidRequestSchema.safeParse(parsed.value);
  if (!validated.success) return new Response(JSON.stringify({ error: "Invalid payload", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });
  return await mutateWorkerVoidForAdmin(validated.data, key) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503, headers: { "Content-Type": "application/json" } });
}
