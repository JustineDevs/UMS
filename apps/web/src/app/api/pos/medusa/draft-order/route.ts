import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import {
  getMedusaAdminSdk,
  getMedusaRegionId,
  getMedusaSalesChannelId,
} from "@/lib/medusa-pos";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { claimAdminIdempotency, completeAdminIdempotency, getRequestHash, parseAdminJson, requireIdempotencyKey } from "@/lib/admin-api-security";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { buildPosSaleFeatureMetadata } from "@universal-music-store/platform-data";
import { z } from "zod";

const draftOrderSchema = z.object({
  items: z.array(z.object({ variantId: z.string().trim().min(1).max(128), quantity: z.number().int().positive().max(100) }).strict()).min(1).max(100),
  email: z.string().trim().email().max(320).optional(),
  posFeatures: z.object({
    orderTag: z.string().trim().max(80).optional(),
    eInvoiceRequested: z.boolean().optional(),
    eInvoiceCustomerEmail: z.string().trim().email().max(320).optional(),
    eInvoiceCustomerTin: z.string().trim().max(40).optional(),
  }).strict().optional(),
}).strict();

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  logAdminApiEvent({
    route: "POST /api/pos/medusa/draft-order",
    correlationId,
    phase: "start",
  });

  const adminSdk = getMedusaAdminSdk();
  const regionId = getMedusaRegionId();
  const salesChannelId = getMedusaSalesChannelId();
  if (!adminSdk || !regionId || !salesChannelId) {
    return correlatedJson(
      correlationId,
      {
        error:
          "POS environment incomplete (MEDUSA_SECRET_API_KEY, MEDUSA_REGION_ID, MEDUSA_SALES_CHANNEL_ID)",
      },
      { status: 503 },
    );
  }

  const parsed = await parseAdminJson(req, draftOrderSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const idempotencyKey = requireIdempotencyKey(req);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const claim = await claimAdminIdempotency(sup.client, {
    actorKey: `${organization.id}:${staff.session.user?.email?.trim().toLowerCase() ?? "unknown"}`,
    actionKey: "pos.medusa.draft-order.create",
    idempotencyKey,
    requestHash: getRequestHash(parsed.data),
  });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Request is already being processed or key was reused" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const body = parsed.data;
  const items = body.items;

  try {
    const { draft_order } = await adminSdk.admin.draftOrder.create({
      email: (body.email?.trim() || "pos@instore.local").slice(0, 320),
      region_id: regionId,
      sales_channel_id: salesChannelId,
      items: items.map((i) => ({
        variant_id: i.variantId,
        quantity: Math.max(1, Math.floor(i.quantity)),
      })),
      metadata: { ...buildPosSaleFeatureMetadata(body.posFeatures ?? {}), organization_id: organization.id },
    });

    logAdminApiEvent({
      route: "POST /api/pos/medusa/draft-order",
      correlationId,
      phase: "ok",
      detail: { draftOrderId: draft_order?.id },
    });

    const responseBody = {
      draftOrderId: draft_order?.id,
      displayId: draft_order?.display_id,
    };
    if (!draft_order?.id) {
      await completeAdminIdempotency(sup.client, claim.id, 502, { error: "Unable to create draft order" });
      return correlatedJson(correlationId, { error: "Unable to create draft order" }, { status: 502 });
    }
    await completeAdminIdempotency(sup.client, claim.id, 200, responseBody);
    return correlatedJson(correlationId, responseBody);
  } catch {
    const msg = "Unable to create draft order";
    logAdminApiEvent({
      route: "POST /api/pos/medusa/draft-order",
      correlationId,
      phase: "error",
      detail: { message: msg },
    });
    const responseBody = { error: msg };
    await completeAdminIdempotency(sup.client, claim.id, 502, responseBody);
    return correlatedJson(correlationId, responseBody, { status: 502 });
  }
}
