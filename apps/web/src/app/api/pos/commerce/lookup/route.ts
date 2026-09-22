import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerPosProducts, findWorkerPosProduct } from "@/lib/pos-worker-catalog";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedError, correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { adminPosCommerceLookupResponseSchema, adminPosCommerceLookupSchema } from "@/lib/admin-api-contracts";

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }
  logAdminApiEvent({
    route: "POST /api/pos/commerce/lookup",
    correlationId,
    phase: "start",
  });

  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(correlationId, { error: "Payload too large" }, { status: 413 });
  const parsed = adminPosCommerceLookupSchema.safeParse(parsedBody.valid ? parsedBody.value : undefined);
  if (!parsed.success) return correlatedJson(correlationId, { error: "Missing barcode or sku" }, { status: 400 });
  const barcode = parsed.data.barcode ?? "";
  const sku = parsed.data.sku ?? "";
  const trimmed = barcode || sku;
  if (!trimmed) {
    return correlatedJson(
      correlationId,
      { error: "Missing barcode or sku" },
      { status: 400 },
    );
  }

  try {
    const products = await fetchWorkerPosProducts({ query: trimmed, limit: 100 });
    const product = findWorkerPosProduct(products, trimmed);
    if (!product) {
      logAdminApiEvent({
        route: "POST /api/pos/commerce/lookup",
        correlationId,
        phase: "error",
        detail: { reason: "not_found" },
      });
      return new Response(null, { status: 404 });
    }
    logAdminApiEvent({
      route: "POST /api/pos/commerce/lookup",
      correlationId,
      phase: "ok",
      detail: { variantId: product.variantId },
    });
    const payload = {
      id: product.variantId,
      sku: product.sku,
      ...(product.barcode ? { barcode: product.barcode } : {}),
      size: product.size,
      color: product.color,
      price: product.price,
      products: { name: product.name },
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    };
    const validated = adminPosCommerceLookupResponseSchema.safeParse(payload);
    if (!validated.success) return correlatedError(correlationId, 502, "Product lookup returned an invalid result", "SERVICE_UNAVAILABLE");
    return correlatedJson(correlationId, validated.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Product lookup unavailable";
    logAdminApiEvent({
      route: "POST /api/pos/commerce/lookup",
      correlationId,
      phase: "error",
      detail: { message: msg },
    });
    return correlatedError(correlationId, 502, "Product lookup is unavailable", "SERVICE_UNAVAILABLE");
  }
}
