import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  getReceiptByOrder,
  saveReceipt,
  markReceiptSent,
  buildReceiptHtml,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { sendResendTransactionalEmail } from "@universal-music-store/resend-mail";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
  parseAdminJson,
} from "@/lib/admin-api-security";
import {
  fetchMedusaOrderJson,
  resolveMedusaOrderReference,
} from "@/lib/medusa-order-bridge";
import { canonicalReceiptOrderFromMedusa } from "@/lib/receipt-order";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { z } from "zod";

const receiptRequestSchema = z
  .object({
    order_id: z.string().trim().min(1).max(200),
    send: z.boolean().default(false),
  })
  .strict();

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user)
    return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "receipts:read")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  const orderReference = req.nextUrl.searchParams.get("order_id");
  if (!orderReference) {
    return correlatedError(cid, 400, "order_id is required", "BAD_REQUEST");
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedError(cid, 403, "Organization membership is not configured", "FORBIDDEN");
  const orderId = await resolveMedusaOrderReference(orderReference);
  if (!orderId) return correlatedError(cid, 404, "Not found", "NOT_FOUND");
  const receipt = await getReceiptByOrder(sb, orderId, organization.id);
  if (!receipt) return correlatedError(cid, 404, "Not found", "NOT_FOUND");
  return correlatedJson(cid, { data: receipt });
}

export async function POST(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user)
    return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "receipts:send")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  const parsed = await parseAdminJson(req, receiptRequestSchema);
  if (!parsed.ok)
    return correlatedError(cid, parsed.status, parsed.error, "VALIDATION_ERROR");
  const body = parsed.data;
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) {
    return correlatedError(cid, 400, "Idempotency-Key is required for receipt mutations", "BAD_REQUEST");
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedError(cid, 403, "Organization membership is not configured", "FORBIDDEN");
  const orderReference = await resolveMedusaOrderReference(body.order_id);
  if (!orderReference) return correlatedError(cid, 404, "Order not found", "NOT_FOUND");
  const orderPayload = await fetchMedusaOrderJson(orderReference);
  if (!orderPayload?.id) return correlatedError(cid, 404, "Order not found", "NOT_FOUND");
  const order = canonicalReceiptOrderFromMedusa(orderPayload);
  if (!order.id) return correlatedError(cid, 404, "Order not found", "NOT_FOUND");
  if (body.send && !order.customer_email) {
    return correlatedError(cid, 400, "The order has no customer email", "BAD_REQUEST");
  }
  if (body.send && !process.env.RESEND_API_KEY?.trim()) {
    return correlatedError(cid, 503, "Receipt email delivery is not configured", "SERVICE_UNAVAILABLE");
  }
  const claim = await claimAdminIdempotency(sb, {
    actorKey: `${organization.id}:${session.user.email!.toLowerCase()}`,
    actionKey: `receipt:${order.id}`,
    idempotencyKey,
    requestHash: getRequestHash(body),
  });
  if (claim.kind === "replay")
    return correlatedJson(cid, claim.body, { status: claim.status });
  if (claim.kind !== "claimed") {
    return correlatedError(cid, 409, "Receipt mutation is already in progress or conflicts with a previous request", "CONFLICT");
  }
  const idempotencyId = claim.id;
  let receipt = await getReceiptByOrder(sb, order.id, organization.id);
  const html = buildReceiptHtml({
    ...order,
    storeName: process.env.STORE_NAME?.trim() || "Universal Music Store",
  });
  if (!receipt) {
    try {
      receipt = await saveReceipt(sb, {
        order_id: order.id,
        organization_id: organization.id,
        customer_email: order.customer_email ?? undefined,
        receipt_html: html,
      });
    } catch {
      const response = correlatedError(cid, 502, "Unable to create receipt", "INTERNAL_ERROR");
      await completeAdminIdempotency(sb, idempotencyId, response.status, {
        error: "Unable to create receipt",
      });
      return response;
    }
    await insertStaffAuditLog(sb, {
      actorEmail: session.user.email ?? "unknown",
      action: "receipt.create",
      resource: "digital_receipts",
      resourceId: receipt.id,
      details: { order_id: order.id, idempotency_key: idempotencyKey ?? null },
    });
  }

  if (order.customer_email && body.send && !receipt.sent_at) {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const fromAddr =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      process.env.RESEND_FROM?.trim() ||
      "noreply@universal-music-store.com";
    if (resendKey) {
      const sent = await sendResendTransactionalEmail({
        apiKey: resendKey,
        from: fromAddr,
        to: order.customer_email,
        subject: `Your receipt for Order #${order.display_id}`,
        html,
        tags: [{ name: "type", value: "staff_receipt" }],
      });
      if (!sent.ok) {
        const response = correlatedError(cid, 502, "Failed to send receipt email", "INTERNAL_ERROR");
        await completeAdminIdempotency(sb, idempotencyId, response.status, {
          error: "Failed to send receipt email",
        });
        return response;
      }
      await markReceiptSent(sb, receipt.id);
      receipt = { ...receipt, sent_at: new Date().toISOString() };
      await insertStaffAuditLog(sb, {
        actorEmail: session.user.email ?? "unknown",
        action: "receipt.send",
        resource: "digital_receipts",
        resourceId: receipt.id,
        details: { order_id: order.id, idempotency_key: idempotencyKey },
      });
    }
  }

  const response = correlatedJson(cid, { data: receipt }, { status: 200 });
  await completeAdminIdempotency(sb, idempotencyId, response.status, {
    data: receipt,
  });
  return response;
}
