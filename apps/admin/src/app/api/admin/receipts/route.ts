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
import { correlatedJson } from "@/lib/staff-api-response";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
  parseAdminJson,
} from "@/lib/admin-api-security";
import { fetchMedusaOrderJson } from "@/lib/medusa-order-bridge";
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
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "receipts:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const orderId = req.nextUrl.searchParams.get("order_id");
  if (!orderId) {
    return correlatedJson(
      cid,
      { error: "order_id is required" },
      { status: 400 },
    );
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization)
    return correlatedJson(
      cid,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const receipt = await getReceiptByOrder(sb, orderId, organization.id);
  if (!receipt)
    return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  return correlatedJson(cid, { data: receipt });
}

export async function POST(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user)
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "receipts:send")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const parsed = await parseAdminJson(req, receiptRequestSchema);
  if (!parsed.ok)
    return correlatedJson(
      cid,
      { error: parsed.error },
      { status: parsed.status },
    );
  const body = parsed.data;
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) {
    return correlatedJson(
      cid,
      { error: "Idempotency-Key is required for receipt mutations" },
      { status: 400 },
    );
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization)
    return correlatedJson(
      cid,
      { error: "Organization membership is not configured" },
      { status: 403 },
    );
  const orderPayload = await fetchMedusaOrderJson(body.order_id);
  if (!orderPayload?.id)
    return correlatedJson(cid, { error: "Order not found" }, { status: 404 });
  const order = canonicalReceiptOrderFromMedusa(orderPayload);
  if (!order.id)
    return correlatedJson(cid, { error: "Order not found" }, { status: 404 });
  if (body.send && !order.customer_email) {
    return correlatedJson(
      cid,
      { error: "The order has no customer email" },
      { status: 400 },
    );
  }
  if (body.send && !process.env.RESEND_API_KEY?.trim()) {
    return correlatedJson(
      cid,
      { error: "Receipt email delivery is not configured" },
      { status: 503 },
    );
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
    return correlatedJson(
      cid,
      { error: "Receipt mutation is already in progress or conflicts with a previous request" },
      { status: 409 },
    );
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
      const response = correlatedJson(
        cid,
        { error: "Unable to create receipt" },
        { status: 502 },
      );
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
        const response = correlatedJson(
          cid,
          { error: "Failed to send receipt email" },
          { status: 502 },
        );
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
