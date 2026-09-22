import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getIdempotencyKey } from "@/lib/admin-api-security";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { adminInvoiceCreateSchema, adminInvoiceResponseSchema, adminInvoicesResponseSchema } from "@/lib/admin-api-contracts";
import {
  createWorkerInvoiceForAdmin,
  fetchWorkerInvoicesForAdmin,
} from "@/lib/worker-admin-bridge";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

async function forwardInvoiceResponse(response: Response, correlationId: string, schema: typeof adminInvoiceResponseSchema | typeof adminInvoicesResponseSchema): Promise<Response> {
  const payload = await readResponseJson<unknown>(response, null);
  if (response.ok) {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return correlatedJson(correlationId, { error: "Invalid invoice response" }, { status: 502 });
    return correlatedJson(correlationId, parsed.data, { status: response.status });
  }
  return correlatedJson(correlationId, payload && typeof payload === "object" ? payload : { error: "Invoice request failed" }, { status: response.status });
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("receipts:read");
  if (!staff.ok) return staff.response;
  const response = await fetchWorkerInvoicesForAdmin();
  if (!response) return correlatedJson(correlationId, { error: "Commerce Worker unavailable" }, { status: 503 });
  return forwardInvoiceResponse(response, correlationId, adminInvoicesResponseSchema);
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("receipts:send");
  if (!staff.ok) return staff.response;
  const parsed = await parseBoundedJson(request, 512 * 1024);
  if (parsed.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  if (!parsed.valid) return correlatedJson(correlationId, { error: "Invalid JSON body" }, { status: 400 });
  const payload = adminInvoiceCreateSchema.safeParse(parsed.value);
  if (!payload.success) return correlatedJson(correlationId, { error: "Invalid invoice payload" }, { status: 400 });
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const response = await createWorkerInvoiceForAdmin({
    body: payload.data,
    idempotencyKey,
  });
  if (!response) return correlatedJson(correlationId, { error: "Commerce Worker unavailable" }, { status: 503 });
  return forwardInvoiceResponse(response, correlationId, adminInvoiceResponseSchema);
}
