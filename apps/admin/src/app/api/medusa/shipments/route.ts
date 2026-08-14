import { randomUUID } from "node:crypto";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { claimAdminIdempotency, completeAdminIdempotency, getRequestHash, parseAdminJson, requireIdempotencyKey } from "@/lib/admin-api-security";
import {
  fetchMedusaOrderJson,
  patchMedusaOrderMetadata,
} from "@/lib/medusa-order-bridge";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { z } from "zod";

const shipmentSchema = z.object({
  orderId: z.string().trim().regex(/^order_/),
  trackingNumber: z.string().trim().min(1).max(200),
  carrierSlug: z.string().trim().min(1).max(80).default("jtexpress-ph"),
  labelUrl: z.string().trim().url().max(2_000).optional(),
}).strict();

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("orders:write");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  logAdminApiEvent({
    route: "POST /api/medusa/shipments",
    correlationId,
    phase: "start",
  });

  const idempotencyKey = requireIdempotencyKey(req);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = await parseAdminJson(req, shipmentSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const { orderId, trackingNumber, carrierSlug, labelUrl } = parsed.data;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });

  const order = await fetchMedusaOrderJson(orderId);
  if (!order) {
    return correlatedJson(correlationId, { error: "Order not found" }, { status: 404 });
  }

  const prev = (order.metadata as Record<string, unknown> | undefined) ?? {};
  if (prev.organization_id !== organization.id) {
    return correlatedJson(correlationId, { error: "Order not found" }, { status: 404 });
  }
  const claim = await claimAdminIdempotency(sup.client, {
    actorKey: `${organization.id}:${staff.session.user?.email?.trim().toLowerCase() ?? "unknown"}`,
    actionKey: `medusa.shipment.create:${orderId}`,
    idempotencyKey,
    requestHash: getRequestHash(parsed.data),
  });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Request is already being processed or key was reused" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const list = Array.isArray(prev.fulfillment_shipments)
    ? [...(prev.fulfillment_shipments as unknown[])]
    : [];

  list.push({
    id: randomUUID(),
    tracking_number: trackingNumber,
    carrier_slug: carrierSlug,
    label_url: labelUrl ?? null,
    shipped_at: new Date().toISOString(),
    status: "pending",
  });

  const meta = {
    ...prev,
    fulfillment_shipments: list,
  };

  const result = await patchMedusaOrderMetadata(orderId, meta);
  if (!result.ok) {
    logAdminApiEvent({
      route: "POST /api/medusa/shipments",
      correlationId,
      phase: "error",
      detail: { orderId, error: result.error },
    });
    const body = { error: "Unable to update order" };
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }

  logAdminApiEvent({
    route: "POST /api/medusa/shipments",
    correlationId,
    phase: "ok",
    detail: { orderId },
  });

  const body = { ok: true };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
