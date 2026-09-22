import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { adminDeliveryShipmentResponseSchema, adminDeliveryShipmentSchema } from "@/lib/admin-api-contracts";
import {
  createWorkerDeliveryShipmentForAdmin,
  fetchWorkerDeliveryShipmentsForAdmin,
} from "@/lib/worker-admin-bridge";
import { readResponseJson } from "@/lib/read-response-json";

async function proxy(response: Response | null, correlationId: string): Promise<Response> {
  if (!response) return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
  const payload = await readResponseJson<unknown>(response, null);
  if (response.ok) {
    const parsed = adminDeliveryShipmentResponseSchema.safeParse(payload);
    if (!parsed.success) return correlatedJson(correlationId, { error: "Invalid Worker response" }, { status: 502 });
    return correlatedJson(correlationId, parsed.data, { status: response.status });
  }
  return correlatedJson(correlationId, payload && typeof payload === "object" ? payload : { error: "Worker request failed" }, { status: response.status });
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "dashboard:read")) return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  return proxy(await fetchWorkerDeliveryShipmentsForAdmin(), correlationId);
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "orders:write")) return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = await parseBoundedJson(request, 256 * 1024);
  if (parsed.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  if (!parsed.valid) return correlatedJson(correlationId, { error: "Invalid JSON body" }, { status: 400 });
  const payload = adminDeliveryShipmentSchema.safeParse(parsed.value);
  if (!payload.success) return correlatedJson(correlationId, { error: "Invalid delivery shipment payload" }, { status: 400 });
  return proxy(await createWorkerDeliveryShipmentForAdmin({ body: payload.data, idempotencyKey }), correlationId);
}
