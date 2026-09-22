import { fetchWorkerStorefrontHomeForAdmin, mutateWorkerStorefrontHomeForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
function unauthorized(requestId: string): Response {
  return new Response(JSON.stringify({ error: "Unauthorized", requestId }), { status: 401 });
}

export async function GET(request: Request) {
  const requestId = getCorrelationId(request);
  if (!(await getAdminSession())) return unauthorized(requestId);
  return await fetchWorkerStorefrontHomeForAdmin() ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503 });
}

export async function PUT(request: Request) {
  const requestId = getCorrelationId(request);
  let value: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 512 * 1024) return new Response(JSON.stringify({ error: "Payload too large", requestId }), { status: 413 });
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    value = parsed as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body", requestId }), { status: 400 });
  }
  if (!(await getAdminSession())) return unauthorized(requestId);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId }), { status: 400 });
  return await mutateWorkerStorefrontHomeForAdmin(value, key) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId }), { status: 503 });
}
