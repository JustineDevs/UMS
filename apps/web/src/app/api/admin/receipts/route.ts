import { NextRequest } from "next/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { getIdempotencyKey, parseAdminJson } from "@/lib/admin-api-security";
import { createWorkerReceiptForAdmin, fetchWorkerReceiptForAdmin } from "@/lib/worker-admin-bridge";
import { adminReceiptCreateSchema, adminReceiptResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

async function proxy(response: Response | null, correlationId: string): Promise<Response> {
  if (!response) return correlatedError(correlationId, 503, "Worker receipt service is unavailable", "SERVICE_UNAVAILABLE");
  const payload = await readResponseJson<unknown>(response, null);
  if (response.ok) {
    const parsed = adminReceiptResponseSchema.safeParse(payload);
    if (!parsed.success) return correlatedError(correlationId, 502, "Invalid receipt response", "INTERNAL_ERROR");
    return correlatedJson(correlationId, parsed.data, { status: response.status });
  }
  return correlatedError(correlationId, response.status, "Receipt request failed", response.status >= 500 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST");
}

export async function GET(request: NextRequest): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("receipts:read");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const orderId = request.nextUrl.searchParams.get("order_id")?.trim();
  if (!orderId) return correlatedError(correlationId, 400, "order_id is required", "BAD_REQUEST");
  return proxy(await fetchWorkerReceiptForAdmin(orderId), correlationId);
}

export async function POST(request: NextRequest): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("receipts:send");
  if (!staff.ok) return tagResponse(staff.response, correlationId);
  const parsed = await parseAdminJson(request, adminReceiptCreateSchema);
  if (!parsed.ok) return correlatedError(correlationId, parsed.status, parsed.error, "VALIDATION_ERROR");
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedError(correlationId, 400, "Idempotency-Key is required", "BAD_REQUEST");
  return proxy(await createWorkerReceiptForAdmin({
    orderId: parsed.data.order_id,
    send: parsed.data.send === true,
    idempotencyKey,
  }), correlationId);
}
