import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { getMedusaAdminSdk } from "@/lib/medusa-pos";
import {
  chatOrderCompletionStatus,
  isAllowedChatOrderTransition,
} from "@/lib/chat-intake-bridge";

const schema = z
  .object({
    status: z.enum([
      "pending",
      "draft_created",
      "processing",
      "pending_payment",
      "completed",
      "failed",
      "cancelled",
    ]),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

async function post(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("chat_orders:manage");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(req, schema);
  if (!parsed.ok)
    return correlatedJson(
      correlationId,
      { error: parsed.error },
      { status: parsed.status },
    );
  const { id } = await params;
  if (!id?.trim())
    return correlatedJson(
      correlationId,
      { error: "Invalid chat order" },
      { status: 400 },
    );
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(
    sup.client,
    staff.session.user?.email,
  );
  if (!organization)
    return correlatedJson(
      correlationId,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const current = await sup.client
    .from("chat_order_intake")
    .select(
      "id,status,updated_at,medusa_draft_order_id,medusa_order_id,medusa_order_display_id,medusa_order_payment_status,payment_status",
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (current.error)
    return correlatedJson(
      correlationId,
      { error: "Unable to load chat order" },
      { status: 502 },
    );
  if (!current.data)
    return correlatedJson(
      correlationId,
      { error: "Chat order not found" },
      { status: 404 },
    );
  const currentStatus = String(current.data.status ?? "pending");
  if (currentStatus === parsed.data.status) {
    return correlatedJson(correlationId, { data: current.data, replayed: true });
  }
  if (parsed.data.status === "completed" && current.data.medusa_order_id) {
    return correlatedJson(correlationId, {
      data: current.data,
      replayed: true,
    });
  }
  if (!isAllowedChatOrderTransition(currentStatus, parsed.data.status)) {
    return correlatedJson(
      correlationId,
      { error: "Invalid chat order transition", code: "WORKFLOW_TRANSITION" },
      { status: 409 },
    );
  }
  if (
    parsed.data.expected_updated_at &&
    current.data.updated_at !== parsed.data.expected_updated_at
  ) {
    return correlatedJson(
      correlationId,
      {
        error: "Chat order changed; reload before updating",
        code: "WORKFLOW_CONFLICT",
      },
      { status: 409 },
    );
  }

  if (parsed.data.status === "completed") {
    const medusaPaymentStatus = String(current.data.medusa_order_payment_status ?? "").toLowerCase();
    if (current.data.payment_status !== "settled" && !["captured", "partially_captured", "paid"].includes(medusaPaymentStatus)) {
      return correlatedJson(correlationId, { error: "Settle the provider payment before completing this chat order", code: "PAYMENT_SETTLEMENT_REQUIRED" }, { status: 409 });
    }
    const draftOrderId =
      typeof current.data.medusa_draft_order_id === "string"
        ? current.data.medusa_draft_order_id.trim()
        : "";
    if (!draftOrderId) {
      return correlatedJson(
        correlationId,
        {
          error: "Chat order has no Medusa draft order to complete",
          code: "BAD_REQUEST",
        },
        { status: 400 },
      );
    }
    let claimed = sup.client
      .from("chat_order_intake")
      .update({ status: "processing" })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .eq("status", currentStatus)
      .is("medusa_order_id", null);
    if (parsed.data.expected_updated_at)
      claimed = claimed.eq("updated_at", parsed.data.expected_updated_at);
    const claim = await claimed
      .select(
        "id,status,updated_at,medusa_draft_order_id,medusa_order_id,medusa_order_display_id",
      )
      .maybeSingle();
    if (claim.error)
      return correlatedJson(
        correlationId,
        { error: "Unable to update chat order" },
        { status: 502 },
      );
    if (!claim.data)
      return correlatedJson(
        correlationId,
        {
          error: "Chat order changed; reload before updating",
          code: "WORKFLOW_CONFLICT",
        },
        { status: 409 },
      );

    const adminSdk = getMedusaAdminSdk();
    if (!adminSdk) {
      await sup.client
        .from("chat_order_intake")
        .update({ status: currentStatus })
        .eq("id", id)
        .eq("organization_id", organization.id)
        .is("medusa_order_id", null);
      return correlatedJson(
        correlationId,
        {
          error: "Medusa admin SDK is not configured",
          code: "MEDUSA_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    let order:
      | {
          id?: unknown;
          display_id?: unknown;
          payment_status?: unknown;
        }
      | undefined;
    try {
      ({ order } = await adminSdk.admin.draftOrder.convertToOrder(draftOrderId));
    } catch {
      await sup.client
        .from("chat_order_intake")
        .update({ status: currentStatus })
        .eq("id", id)
        .eq("organization_id", organization.id)
        .is("medusa_order_id", null);
      return correlatedJson(
        correlationId,
        { error: "Unable to convert Medusa draft order", code: "MEDUSA_UNAVAILABLE" },
        { status: 502 },
      );
    }
    const medusaOrderId =
      order?.id != null && String(order.id).trim() ? String(order.id) : "";
    if (!medusaOrderId) {
      await sup.client
        .from("chat_order_intake")
        .update({ status: currentStatus })
        .eq("id", id)
        .eq("organization_id", organization.id)
        .is("medusa_order_id", null);
      return correlatedJson(
        correlationId,
        {
          error: "Converted draft order missing id from Medusa",
          code: "MEDUSA_UNAVAILABLE",
        },
        { status: 502 },
      );
    }

    const nextStatus = chatOrderCompletionStatus(order?.payment_status);
    const completed = await sup.client
      .from("chat_order_intake")
      .update({
        status: nextStatus,
        medusa_order_id: medusaOrderId,
        medusa_order_display_id:
          order?.display_id != null ? String(order.display_id) : null,
        medusa_order_payment_status:
          order?.payment_status != null ? String(order.payment_status) : null,
      })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .is("medusa_order_id", null)
      .select(
        "id,status,updated_at,medusa_draft_order_id,medusa_order_id,medusa_order_display_id,medusa_order_payment_status",
      )
      .maybeSingle();
    if (completed.error || !completed.data)
      return correlatedJson(
        correlationId,
        { error: "Unable to persist completed chat order" },
        { status: 502 },
      );

    await insertStaffAuditLog(sup.client, {
      actorEmail: staff.session.user?.email ?? "local-admin@localhost",
      action: "chat_order.complete_draft",
      resource: "chat_order_intake",
      resourceId: id,
      details: {
        organization_id: organization.id,
        medusa_draft_order_id: draftOrderId,
        medusa_order_id: medusaOrderId,
        medusa_order_payment_status: completed.data.medusa_order_payment_status,
        status: completed.data.status,
      },
      before: current.data,
      after: completed.data,
    });
    return correlatedJson(correlationId, { data: completed.data });
  }

  let update = sup.client
    .from("chat_order_intake")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("organization_id", organization.id);
  if (parsed.data.expected_updated_at)
    update = update.eq("updated_at", parsed.data.expected_updated_at);
  const { data, error } = await update
    .select("id,status,updated_at")
    .maybeSingle();
  if (error)
    return correlatedJson(
      correlationId,
      { error: "Unable to update chat order" },
      { status: 502 },
    );
  if (!data)
    return correlatedJson(
      correlationId,
      {
        error: "Chat order changed; reload before updating",
        code: "WORKFLOW_CONFLICT",
      },
      { status: 409 },
    );
  await insertStaffAuditLog(sup.client, {
    actorEmail: staff.session.user?.email ?? "local-admin@localhost",
    action: "chat_order.status",
    resource: "chat_order_intake",
    resourceId: id,
    details: { status: parsed.data.status, organization_id: organization.id },
  });
  return correlatedJson(correlationId, { data });
}

export const POST = withAdminMutationIdempotency("/admin/chat-orders/[id]/status:POST", post);
