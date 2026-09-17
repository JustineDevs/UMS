import { recordInvoiceLifecycle, type InvoiceLifecycleEvent, type InvoiceStatus } from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash, parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";

const schema = z.object({ action: z.enum(["retry", "void", "refund"]) }).strict();
const targets: Record<"retry" | "void" | "refund", { event: InvoiceLifecycleEvent; status: InvoiceStatus }> = {
  retry: { event: "retry", status: "retryable" },
  void: { event: "void", status: "voided" },
  refund: { event: "refund", status: "refunded" },
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("receipts:send");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(req, schema);
  if (!parsed.ok) return correlatedError(correlationId, parsed.status, parsed.error, "VALIDATION_ERROR");
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) return correlatedError(correlationId, 400, "Idempotency-Key is required", "VALIDATION_ERROR");
  const { id } = await params;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedError(correlationId, 403, "Organization membership is not configured", "FORBIDDEN");
  const invoice = await sup.client.from("admin_invoices").select("id,status,fiscal_status").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (invoice.error) return correlatedError(correlationId, 502, "Unable to load invoice", "SERVICE_UNAVAILABLE");
  if (!invoice.data) return correlatedError(correlationId, 404, "Invoice not found", "NOT_FOUND");
  const target = targets[parsed.data.action];
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${staff.session.user?.email ?? "unknown"}`, actionKey: `admin.invoice.${parsed.data.action}:${id}`, idempotencyKey, requestHash: getRequestHash({ id, action: parsed.data.action }) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind !== "claimed") return correlatedError(correlationId, claim.kind === "conflict" ? 409 : 503, claim.kind === "conflict" ? "Idempotency key is already in use" : "Idempotency service unavailable", claim.kind === "conflict" ? "CONFLICT" : "SERVICE_UNAVAILABLE");
  try {
    const row = await recordInvoiceLifecycle(sup.client, { organizationId: organization.id, invoiceId: id, event: target.event, status: target.status, fiscalStatus: parsed.data.action === "void" && invoice.data.fiscal_status !== "non_fiscal" ? "voided" : invoice.data.fiscal_status, idempotencyKey, actorEmail: staff.session.user?.email });
    const body = { data: row };
    await completeAdminIdempotency(sup.client, claim.id, 200, body);
    return correlatedJson(correlationId, body);
  } catch {
    const body = { error: "Invoice lifecycle transition failed" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedError(correlationId, 409, body.error, "CONFLICT");
  }
}
