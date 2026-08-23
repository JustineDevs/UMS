import { staffSessionAllows } from "@universal-music-store/database";
import { getStaffSession } from "@/lib/requireStaffSession";
import {
  completePaymentRefundAudit,
  enqueueOutboxEvent,
  insertPaymentRefundAudit,
  PAYMENT_OUTBOX_EVENT_TYPES,
  tryCreateSupabaseClient,
  recordCommerceAttributionRefund,
} from "@universal-music-store/platform-data";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import {
  fetchMedusaOrderPaymentsForAdmin,
  fetchMedusaOrderDetailForAdmin,
  refundMedusaPayment,
} from "@/lib/medusa-order-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getRequestHash,
  parseAdminJson,
  requireIdempotencyKey,
  stepUpRequired,
} from "@/lib/admin-api-security";
import { z } from "zod";

const refundSchema = z.object({
  payment_id: z.string().trim().min(1).max(128).optional(),
  amount_minor: z.number().int().positive().max(100_000_000).optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const correlationId = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(correlationId, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "orders:write")) {
    return correlatedJson(correlationId, { error: "Forbidden" }, { status: 403 });
  }
  const idempotencyKey = requireIdempotencyKey(req);
  if (!idempotencyKey) {
    return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  }
  if (!stepUpRequired("orders.refund", req)) {
    return correlatedJson(correlationId, { error: "Step-up authentication required" }, { status: 403 });
  }

  const { orderId } = await ctx.params;
  if (!orderId?.startsWith("order_")) {
    return correlatedJson(correlationId, { error: "Invalid order id" }, { status: 400 });
  }

  const parsed = await parseAdminJson(req, refundSchema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const body = parsed.data;

  const payments = await fetchMedusaOrderPaymentsForAdmin(orderId);
  if (payments.length === 0) {
    return correlatedJson(
      correlationId,
      { error: "No payments found for this order" },
      { status: 404 },
    );
  }

  const paymentId =
    typeof body.payment_id === "string" && body.payment_id.trim().length > 0
      ? body.payment_id.trim()
      : payments[0]?.id;
  if (!paymentId) {
    return correlatedJson(correlationId, { error: "No payment id" }, { status: 400 });
  }

  const selected = payments.find((p) => p.id === paymentId);
  if (!selected) {
    return correlatedJson(correlationId, { error: "Payment not on this order" }, { status: 400 });
  }

  const captured =
    selected.captured_amount != null && Number.isFinite(selected.captured_amount)
      ? selected.captured_amount
      : selected.amount;
  const alreadyRefunded =
    selected.refunded_amount != null && Number.isFinite(selected.refunded_amount)
      ? selected.refunded_amount
      : 0;
  const refundable = Math.max(0, captured - alreadyRefunded);

  let amountMinor =
    body.amount_minor != null && Number.isFinite(Number(body.amount_minor))
      ? Math.floor(Number(body.amount_minor))
      : refundable;
  if (amountMinor <= 0) {
    return correlatedJson(
      correlationId,
      { error: "Nothing to refund for this payment" },
      { status: 400 },
    );
  }
  if (amountMinor > refundable) {
    return correlatedJson(
      correlationId,
      {
        error: `Amount exceeds refundable balance (${refundable} minor units).`,
      },
      { status: 400 },
    );
  }

  const sb = tryCreateSupabaseClient();
  const claim = await claimAdminIdempotency(sb, {
    actorKey: typeof session.user.email === "string" ? session.user.email : "unknown",
    actionKey: `orders.refund:${orderId}:${paymentId}`,
    idempotencyKey,
    requestHash: getRequestHash({ orderId, paymentId, amountMinor, note: body.note ?? null }),
  });
  if (claim.kind === "unavailable") {
    return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  }
  if (claim.kind === "conflict") {
    return correlatedJson(correlationId, { error: "Request is already being processed or key was reused" }, { status: 409 });
  }
  if (claim.kind === "replay") {
    return correlatedJson(correlationId, claim.body, { status: claim.status });
  }

  logAdminApiEvent({
    route: "POST /api/admin/orders/[orderId]/refund",
    correlationId,
    phase: "start",
    detail: { orderId, paymentId, amountMinor },
  });

  let refundAuditId: string | null = null;
  if (sb) {
    refundAuditId = await insertPaymentRefundAudit(sb, {
      medusaOrderId: orderId,
      medusaPaymentId: paymentId,
      amountMinor,
      actorEmail: typeof session.user.email === "string" ? session.user.email : null,
      note: typeof body.note === "string" ? body.note : null,
      requestCorrelationId: correlationId,
    }).catch(() => null);
    await enqueueOutboxEvent(sb, {
      aggregate_type: "payment_refund",
      aggregate_id: orderId,
      event_type: PAYMENT_OUTBOX_EVENT_TYPES.PAYMENT_ATTEMPT_REFUND_REQUESTED,
      payload: {
        order_id: orderId,
        payment_id: paymentId,
        amount_minor: amountMinor,
        actor_email:
          typeof session.user.email === "string" ? session.user.email : null,
        note: typeof body.note === "string" ? body.note : null,
        request_correlation_id: correlationId,
        refund_audit_id: refundAuditId,
      },
    }).catch(() => {});
  }

  const result = await refundMedusaPayment(
    paymentId,
    amountMinor,
    typeof body.note === "string" ? body.note : undefined,
  );

  if (!result.ok) {
    const status = result.status >= 400 ? result.status : 502;
    const responseBody = { error: result.error ?? "Refund did not complete" };
    if (sb && refundAuditId) {
      await completePaymentRefundAudit(sb, refundAuditId, false, result.error ?? "refund_failed").catch(
        () => {},
      );
    }
    await completeAdminIdempotency(sb, claim.id, status, responseBody);
    logAdminApiEvent({
      route: "POST /api/admin/orders/[orderId]/refund",
      correlationId,
      phase: "error",
      detail: { orderId, error: result.error },
    });
    return correlatedJson(
      correlationId,
      responseBody,
      { status },
    );
  }

  if (sb && refundAuditId) {
    await completePaymentRefundAudit(sb, refundAuditId, true, null).catch(() => {});
  }
  if (sb) {
    const order = await fetchMedusaOrderDetailForAdmin(orderId).catch(() => null);
    await recordCommerceAttributionRefund(sb, {
      organizationId: process.env.DEFAULT_ORGANIZATION_ID?.trim() || null,
      orderId,
      refundId: `${paymentId}:${idempotencyKey}`,
      amountMinor,
      currency: order?.order.currency ?? "PHP",
    }).catch(() => {});
  }

  await completeAdminIdempotency(sb, claim.id, 200, {
    ok: true,
    payment_id: paymentId,
    amount_minor: amountMinor,
  });

  logAdminApiEvent({
    route: "POST /api/admin/orders/[orderId]/refund",
    correlationId,
    phase: "ok",
    detail: { orderId, paymentId, amountMinor },
  });

  return correlatedJson(correlationId, {
    ok: true as const,
    payment_id: paymentId,
    amount_minor: amountMinor,
  });
}
