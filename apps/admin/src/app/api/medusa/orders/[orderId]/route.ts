import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getRequestHash,
  parseAdminJson,
  requireIdempotencyKey,
} from "@/lib/admin-api-security";
import {
  fetchMedusaOrderJson,
  patchMedusaOrderMetadata,
} from "@/lib/medusa-order-bridge";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { appendCanonicalOrderState, type CanonicalOrderStatus } from "@universal-music-store/platform-data";
import { z } from "zod";

const orderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "processing", "packed", "shipped", "delivered", "cancelled", "returned", "refunded", "failed"]),
}).strict();

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("orders:write");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  logAdminApiEvent({
    route: "PATCH /api/medusa/orders/[orderId]",
    correlationId,
    phase: "start",
  });

  const { orderId } = await ctx.params;
  if (!orderId?.startsWith("order_")) {
    return correlatedJson(
      correlationId,
      { error: "Invalid order id" },
      { status: 400 },
    );
  }

  const idempotencyKey = requireIdempotencyKey(req);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = await parseAdminJson(req, orderStatusSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const status: CanonicalOrderStatus = parsed.data.status;

  const order = await fetchMedusaOrderJson(orderId);
  if (!order) {
    return correlatedJson(correlationId, { error: "Order not found" }, { status: 404 });
  }
  const currentMetadata = (order.metadata as Record<string, unknown> | undefined) ?? {};
  if (currentMetadata.organization_id !== organization.id) {
    return correlatedJson(correlationId, { error: "Order not found" }, { status: 404 });
  }
  const claim = await claimAdminIdempotency(sup.client, {
    actorKey: `${organization.id}:${staff.session.user?.email?.trim().toLowerCase() ?? "unknown"}`,
    actionKey: `medusa.order.status:${orderId}`,
    idempotencyKey,
    requestHash: getRequestHash(parsed.data),
  });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Request is already being processed or key was reused" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });

  const meta = { ...currentMetadata, oms_status: status };
  const result = await patchMedusaOrderMetadata(orderId, meta);
  if (!result.ok) {
    logAdminApiEvent({
      route: "PATCH /api/medusa/orders/[orderId]",
      correlationId,
      phase: "error",
      detail: { orderId, error: result.error },
    });
    const body = { error: "Unable to update order" };
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }

  try {
    await appendCanonicalOrderState(sup.client, {
      organizationId: organization.id,
      medusaOrderId: orderId,
      status,
      idempotencyKey,
      eventType: "status_changed",
      source: staff.session.user?.email ?? "admin",
      metadata: { source: "medusa-order-status" },
    });
  } catch {
    await patchMedusaOrderMetadata(orderId, currentMetadata);
    const body = { error: "Unable to record canonical order state" };
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }

  logAdminApiEvent({
    route: "PATCH /api/medusa/orders/[orderId]",
    correlationId,
    phase: "ok",
    detail: { orderId, status },
  });

  const body = { status };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
