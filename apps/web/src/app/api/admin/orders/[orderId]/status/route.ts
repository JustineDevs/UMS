import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { updateWorkerOrderStatusForAdmin } from "@/lib/worker-admin-bridge";
import { adminOrderStatusResponseSchema, adminOrderStatusSchema as orderStatusSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("orders:write");
  if (!staff.ok) return tagResponse(staff.response, correlationId);

  const { orderId } = await context.params;
  if (!/^order_[A-Za-z0-9_-]{1,120}$/.test(orderId)) {
    return correlatedJson(correlationId, { error: "Invalid order id" }, { status: 400 });
  }
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const bounded = await parseBoundedJson(request, 16 * 1024);
  const parsed = orderStatusSchema.safeParse(bounded.valid ? bounded.value : null);
  if (!parsed.success) return correlatedJson(correlationId, { error: "Invalid order status" }, { status: 400 });

  const response = await updateWorkerOrderStatusForAdmin({ orderId, status: parsed.data.status, idempotencyKey });
  if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
  const payload = await readResponseJson<unknown>(response, null);
  logAdminApiEvent({ route: "PATCH /api/admin/orders/[orderId]/status", correlationId, phase: response.ok ? "ok" : "error", detail: { orderId, status: parsed.data.status } });
  if (response.ok) {
    const validated = adminOrderStatusResponseSchema.safeParse(payload);
    if (!validated.success) return correlatedJson(correlationId, { error: "Invalid Worker response" }, { status: 502 });
    return correlatedJson(correlationId, validated.data, { status: response.status });
  }
  return correlatedJson(correlationId, payload && typeof payload === "object" ? payload : { error: "Commerce Worker request failed" }, { status: response.status });
}
