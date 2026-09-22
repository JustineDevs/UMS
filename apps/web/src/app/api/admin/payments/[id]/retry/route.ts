import { mutateWorkerPaymentRetryForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(req);
  const key = req.headers.get("Idempotency-Key")?.trim();
  if (!key) return new Response(JSON.stringify({ error: "Idempotency-Key is required", requestId: correlationId }), { status: 400 });
  const { id } = await ctx.params;
  if (!id?.trim()) return new Response(JSON.stringify({ error: "Missing id", requestId: correlationId }), { status: 400 });
  return await mutateWorkerPaymentRetryForAdmin(id, key) ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503 });
}
