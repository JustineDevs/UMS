import { NextRequest } from "next/server";
import { z } from "zod";
import { sendResendTransactionalEmail } from "@universal-music-store/resend-mail";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import {
  claimAdminIdempotency,
  completeAdminIdempotency,
  getIdempotencyKey,
  getRequestHash,
  parseAdminJson,
} from "@/lib/admin-api-security";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { fetchMedusaCustomerById } from "@/lib/customers-bridge";

export const dynamic = "force-dynamic";
const lineSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    quantity: z.number().finite().int().min(1).max(10000),
    unitPrice: z.number().finite().min(0).max(100000000),
  })
  .strict();
const detailsSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40),
    website: z.string().trim().max(240),
    addressLines: z.array(z.string().trim().max(160)).max(6),
    taxId: z.string().trim().max(80),
    issuerName: z.string().trim().max(160),
  })
  .strict();
const invoiceSchema = z
  .object({
    referenceNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/),
    issuedDate: z.string().date(),
    paymentDueDate: z.string().date(),
    from: detailsSchema,
    to: z
      .object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(160),
        email: z.string().trim().email().max(320),
        addressLines: z.array(z.string().trim().max(160)).max(6),
        taxId: z.string().trim().max(80),
      })
      .strict(),
    taxId: z.enum(["gst", "vat", "service-tax", "none"]),
    discountType: z.enum(["fixed", "percent"]),
    discountValue: z.number().finite().min(0).max(100000000),
    items: z.array(lineSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.paymentDueDate < value.issuedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentDueDate"],
        message: "Payment due date cannot precede issued date",
      });
    }
    if (value.discountType === "percent" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discount cannot exceed 100",
      });
    }
  });
const requestSchema = z
  .object({
    invoice: invoiceSchema,
    mode: z.enum(["draft", "send"]).default("draft"),
  })
  .strict();

function totalOf(invoice: z.infer<typeof invoiceSchema>) {
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discount =
    invoice.discountType === "percent"
      ? (subtotal * invoice.discountValue) / 100
      : invoice.discountValue;
  const taxable = Math.max(0, subtotal - Math.min(discount, subtotal));
  const rate =
    invoice.taxId === "gst"
      ? 18
      : invoice.taxId === "vat"
        ? 12
        : invoice.taxId === "service-tax"
          ? 10
          : 0;
  return Number((taxable + (taxable * rate) / 100).toFixed(2));
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );
}
function invoiceHtml(invoice: z.infer<typeof invoiceSchema>, total: number) {
  const rows = invoice.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>PHP ${item.unitPrice.toFixed(2)}</td><td>PHP ${(item.quantity * item.unitPrice).toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<h1>Invoice ${escapeHtml(invoice.referenceNumber)}</h1><p>From ${escapeHtml(invoice.from.name)} to ${escapeHtml(invoice.to.name)}</p><p>Issued ${invoice.issuedDate}, due ${invoice.paymentDueDate}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p><strong>Total: PHP ${total.toFixed(2)}</strong></p>`;
}

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("receipts:read");
  if (!staff.ok) return staff.response;
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
  const { data, error } = await sup.client
    .from("admin_invoices")
    .select(
      "id,reference_number,status,currency,total,recipient_email,sent_at,created_by,created_at,updated_at",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    return correlatedJson(
      correlationId,
      { error: "Unable to load invoices" },
      { status: 502 },
    );
  return correlatedJson(correlationId, { data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("receipts:send");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(req, requestSchema);
  if (!parsed.ok)
    return correlatedJson(
      correlationId,
      { error: parsed.error },
      { status: parsed.status },
    );
  const { invoice, mode } = parsed.data;
  const total = totalOf(invoice);
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
  const customer = await fetchMedusaCustomerById(invoice.to.id);
  if (!customer?.email) {
    return correlatedJson(
      correlationId,
      { error: "Invoice recipient is unavailable" },
      { status: 404 },
    );
  }
  if (customer.email.trim().toLowerCase() !== invoice.to.email.trim().toLowerCase()) {
    return correlatedJson(
      correlationId,
      { error: "Invoice recipient changed; reload the customer" },
      { status: 409 },
    );
  }
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey)
    return correlatedJson(
      correlationId,
      { error: "Idempotency-Key is required for invoice mutations" },
      { status: 400 },
    );
  const claim = await claimAdminIdempotency(sup.client, {
    actorKey: `${organization.id}:${staff.session.user?.email ?? "local-admin@localhost"}`,
    actionKey: "admin.invoice.create",
    idempotencyKey,
    requestHash: getRequestHash(parsed.data),
  });
  if (claim.kind === "replay")
    return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind !== "claimed")
    return correlatedJson(
      correlationId,
      {
        error:
          "Invoice mutation is already in progress or conflicts with a previous request",
      },
      { status: 409 },
    );
  const idempotencyId = claim.id;
  const canonicalName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
    customer.email;
  const safeInvoice = {
    ...invoice,
    to: {
      ...invoice.to,
      id: customer.id,
      name: canonicalName,
      email: customer.email,
    },
  };
  const { data, error } = await sup.client
    .from("admin_invoices")
    .insert({
      organization_id: organization.id,
      reference_number: invoice.referenceNumber,
      status: "draft",
      currency: "PHP",
      total,
      recipient_email: customer.email,
      payload: safeInvoice,
      created_by: staff.session.user?.email ?? "local-admin@localhost",
    })
    .select(
      "id,reference_number,status,currency,total,recipient_email,sent_at,created_at",
    )
    .single();
  if (error || !data) {
    const response = correlatedJson(
      correlationId,
      {
        error:
          error?.code === "23505"
            ? "Reference number already exists"
            : "Unable to save invoice",
      },
      { status: error?.code === "23505" ? 409 : 502 },
    );
    await completeAdminIdempotency(sup.client, idempotencyId, response.status, {
      error:
        error?.code === "23505"
          ? "Reference number already exists"
          : "Unable to save invoice",
    });
    return response;
  }
  let result = data;
  if (mode === "send") {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (!resendKey) {
      const response = correlatedJson(
        correlationId,
        {
          error: "Invoice saved as draft; RESEND_API_KEY is not configured",
          data,
        },
        { status: 503 },
      );
      await completeAdminIdempotency(
        sup.client,
        idempotencyId,
        response.status,
        {
          error: "Invoice saved as draft; RESEND_API_KEY is not configured",
          data,
        },
      );
      return response;
    }
    const sent = await sendResendTransactionalEmail({
      apiKey: resendKey,
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        process.env.RESEND_FROM?.trim() ||
        "noreply@universal-music-store.com",
      to: invoice.to.email,
      subject: `Invoice ${invoice.referenceNumber}`,
      html: invoiceHtml(safeInvoice, total),
      tags: [{ name: "type", value: "admin_invoice" }],
    });
    if (!sent.ok) {
      const response = correlatedJson(
        correlationId,
        { error: "Invoice saved as draft; email delivery failed", data },
        { status: 502 },
      );
      await completeAdminIdempotency(
        sup.client,
        idempotencyId,
        response.status,
        { error: "Invoice saved as draft; email delivery failed", data },
      );
      return response;
    }
    const updated = await sup.client
      .from("admin_invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(
        "id,reference_number,status,currency,total,recipient_email,sent_at,created_at",
      )
      .single();
    if (updated.error || !updated.data) {
      const response = correlatedJson(
        correlationId,
        {
          error: "Invoice email sent but invoice status could not be recorded",
        },
        { status: 502 },
      );
      await completeAdminIdempotency(
        sup.client,
        idempotencyId,
        response.status,
        {
          error: "Invoice email sent but invoice status could not be recorded",
        },
      );
      return response;
    }
    result = updated.data;
  }
  await insertStaffAuditLog(sup.client, {
    actorEmail: staff.session.user?.email ?? "local-admin@localhost",
    action: mode === "send" ? "invoice.send" : "invoice.create",
    resource: "admin_invoice",
    resourceId: String(data.id),
    details: {
      reference_number: invoice.referenceNumber,
      total,
      currency: "PHP",
      status: result.status,
    },
  });
  const response = correlatedJson(
    correlationId,
    { data: result },
    { status: 201 },
  );
  await completeAdminIdempotency(sup.client, idempotencyId, response.status, {
    data: result,
  });
  return response;
}
