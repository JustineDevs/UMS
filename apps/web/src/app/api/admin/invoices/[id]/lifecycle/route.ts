import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getIdempotencyKey, parseAdminJson } from "@/lib/admin-api-security";
import { updateWorkerInvoiceLifecycleForAdmin } from "@/lib/worker-admin-bridge";
import { adminInvoiceLifecycleSchema, adminInvoiceResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("receipts:send");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(request, adminInvoiceLifecycleSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const { id } = await params;
  const response = await updateWorkerInvoiceLifecycleForAdmin({ invoiceId: id, action: parsed.data.action, idempotencyKey });
  if (!response) return correlatedJson(correlationId, { error: "Commerce Worker unavailable" }, { status: 503 });
  const payload = await readResponseJson<unknown>(response, null);
  if (response.ok) {
    const parsedResponse = adminInvoiceResponseSchema.safeParse(payload);
    if (!parsedResponse.success) return correlatedJson(correlationId, { error: "Invalid invoice response" }, { status: 502 });
    return correlatedJson(correlationId, parsedResponse.data, { status: response.status });
  }
  return correlatedJson(correlationId, payload && typeof payload === "object" ? payload : { error: "Invoice lifecycle request failed" }, { status: response.status });
}
