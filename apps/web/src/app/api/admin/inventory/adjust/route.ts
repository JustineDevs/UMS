import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { adjustWorkerInventoryForAdmin } from "@/lib/worker-admin-bridge";
import { adminInventoryAdjustmentResponseSchema, adminInventoryAdjustmentSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email)
    return correlatedJson(
      correlationId,
      { error: "Unauthorized" },
      { status: 401 },
    );
  if (!staffSessionAllows(session, "inventory:write"))
    return correlatedJson(
      correlationId,
      { error: "Forbidden" },
      { status: 403 },
    );
  const bounded = await parseBoundedJson(req, 16 * 1024);
  if (bounded.tooLarge)
    return correlatedJson(
      correlationId,
      { error: "Payload too large" },
      { status: 413 },
    );
  const parsed = adminInventoryAdjustmentSchema.safeParse(bounded.valid ? bounded.value : null);
  if (!parsed.success)
    return correlatedJson(correlationId, { error: "Invalid inventory adjustment payload" }, { status: 400 });
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey)
    return correlatedJson(
      correlationId,
      { error: "Idempotency-Key is required" },
      { status: 400 },
    );
  const response = await adjustWorkerInventoryForAdmin({
    productId: parsed.data.productId,
    variantId: parsed.data.variantId,
    stockedQuantity: parsed.data.stockedQuantity,
    delta: parsed.data.delta,
    expectedStockedQuantity: parsed.data.expectedStockedQuantity,
    locationId: parsed.data.locationId,
    reason: parsed.data.reason,
    idempotencyKey,
  });
  if (!response)
    return correlatedJson(correlationId, { error: "Commerce Worker is unavailable" }, { status: 503 });
  const payload = await readResponseJson<Record<string, unknown>>(response, {});
  if (!response.ok) return correlatedJson(correlationId, payload, { status: response.status });
  const parsedResponse = adminInventoryAdjustmentResponseSchema.safeParse(payload);
  if (!parsedResponse.success) return correlatedJson(correlationId, { error: "Inventory adjustment response is invalid", code: "SERVICE_UNAVAILABLE" }, { status: 502 });
  return correlatedJson(correlationId, parsedResponse.data, { status: response.status });
}
