import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceStatus = "draft" | "sending" | "sent" | "failed" | "retryable" | "voided" | "refunded";
export type InvoiceLifecycleStatus = InvoiceStatus;
export type FiscalStatus = "non_fiscal" | "draft" | "issued" | "voided";
export type InvoiceLifecycleEvent = "create" | "send" | "fail" | "retry" | "void" | "refund";

export function assertInvoiceTransition(from: InvoiceStatus | null, event: InvoiceLifecycleEvent | InvoiceStatus, to?: InvoiceStatus) {
  if (to === undefined) {
    const next = event as InvoiceStatus;
    const direct: Record<string, InvoiceStatus[]> = {
      draft: ["sending", "sent", "failed", "voided"], failed: ["retryable", "sent", "voided"], sent: ["voided", "refunded"], sending: ["sent", "failed"], retryable: ["sending", "voided"],
    };
    if (!from || !direct[from]?.includes(next)) throw new Error(`Invalid invoice transition: ${from ?? "create"} -> ${next}`);
    return;
  }
  const allowed = event === "create" ? from === null && to === "draft" : event === "send" ? (from === "draft" && to === "sending") || (from === "sending" && to === "sent") : event === "fail" ? (from === "draft" || from === "sending") && to === "failed" : event === "retry" ? from === "failed" && to === "retryable" : event === "void" ? ["draft", "sending", "sent", "failed", "retryable"].includes(from ?? "") && to === "voided" : event === "refund" && from === "sent" && to === "refunded";
  if (!allowed) throw new Error(`Invalid invoice transition: ${from ?? "create"} -> ${to}`);
}

export async function recordInvoiceLifecycle(supabase: SupabaseClient, input: {
  organizationId: string; invoiceId: string; event?: InvoiceLifecycleEvent; status?: InvoiceStatus; toStatus?: InvoiceStatus;
  fiscalStatus?: FiscalStatus; idempotencyKey: string; errorMessage?: string | null; actorEmail?: string | null; metadata?: Record<string, unknown>;
}) {
  const organizationId = input.organizationId.trim(), invoiceId = input.invoiceId.trim(), idempotencyKey = input.idempotencyKey.trim();
  if (!organizationId || !invoiceId || !idempotencyKey) throw new Error("organizationId, invoiceId, and idempotencyKey are required");
  const { data, error } = await supabase.rpc("record_invoice_lifecycle", {
    p_organization_id: organizationId, p_invoice_id: invoiceId, p_event: input.event ?? (input.toStatus === "failed" ? "fail" : input.toStatus === "retryable" ? "retry" : input.toStatus === "voided" ? "void" : input.toStatus === "refunded" ? "refund" : "send"), p_status: input.status ?? input.toStatus,
    p_fiscal_status: input.fiscalStatus ?? "non_fiscal", p_idempotency_key: idempotencyKey, p_error_message: input.errorMessage ?? null, p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}
