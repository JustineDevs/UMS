import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError } from "@/lib/staff-api-response";
import { requireIdempotencyKey, stepUpRequired } from "@/lib/admin-api-security";
import { adminOrderRefundResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

async function post(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(correlationId, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "orders:write")) return correlatedError(correlationId, 403, "Forbidden", "FORBIDDEN");
  if (!requireIdempotencyKey(req)) return correlatedError(correlationId, 400, "Idempotency-Key is required", "BAD_REQUEST");
  if (!stepUpRequired("orders.refund", req)) return correlatedError(correlationId, 403, "Step-up authentication required", "FORBIDDEN");
  const { orderId } = await ctx.params;
  if (!orderId?.startsWith("order_")) return correlatedError(correlationId, 400, "Invalid order id", "BAD_REQUEST");
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) return correlatedError(correlationId, 503, "Worker API is not configured", "SERVICE_UNAVAILABLE");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) return correlatedError(correlationId, 401, "Staff session is unavailable", "UNAUTHORIZED");
  const response = await fetch(`${base}/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": req.headers.get("Idempotency-Key")!.trim(),
      "X-Request-ID": correlationId,
      ...(req.headers.get("x-admin-step-up") ? { "x-admin-step-up": req.headers.get("x-admin-step-up")! } : {}),
    },
    body: await req.text(),
    cache: "no-store",
  });
  const payload = await readResponseJson<unknown>(response, null);
  if (response.ok) {
    const validated = adminOrderRefundResponseSchema.safeParse(payload);
    if (!validated.success) return correlatedError(correlationId, 502, "Invalid Worker response", "SERVICE_UNAVAILABLE");
    return new Response(JSON.stringify(validated.data), { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-ID": correlationId } });
  }
  return new Response(JSON.stringify(payload && typeof payload === "object" ? payload : { error: "Commerce Worker request failed" }), { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-ID": correlationId } });
}

export const POST = post;
