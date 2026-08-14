import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type PaymentRefundAuditRow = {
  id: string;
  medusa_order_id: string;
  medusa_payment_id: string;
  amount_minor: number;
  actor_email: string | null;
  note: string | null;
  request_correlation_id: string | null;
  status: string;
  result_error: string | null;
  created_at: string;
  completed_at: string | null;
};

export async function insertPaymentRefundAudit(
  supabase: SupabaseClient,
  input: {
    medusaOrderId: string;
    medusaPaymentId: string;
    amountMinor: number;
    actorEmail: string | null;
    note: string | null;
    requestCorrelationId: string | null;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("payment_refund_audit")
    .insert({
      medusa_order_id: input.medusaOrderId,
      medusa_payment_id: input.medusaPaymentId,
      amount_minor: input.amountMinor,
      actor_email: input.actorEmail,
      note: input.note,
      request_correlation_id: input.requestCorrelationId,
      status: "requested",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

export async function completePaymentRefundAudit(
  supabase: SupabaseClient,
  id: string,
  ok: boolean,
  resultError?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("payment_refund_audit")
    .update({
      status: ok ? "completed" : "failed",
      result_error: ok ? null : (resultError ?? "failed"),
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error && !isMissingTableOrSchemaError(error)) throw error;
}

export async function insertCustomerReturnRequestAudit(
  supabase: SupabaseClient,
  input: {
    medusaOrderId: string;
    customerEmail: string;
    items: unknown[];
    note: string | null;
    medusaResponse: unknown;
    staffReviewJobId: string | null;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("customer_return_request_audit")
    .insert({
      medusa_order_id: input.medusaOrderId,
      customer_email: input.customerEmail,
      items: input.items,
      note: input.note,
      medusa_response: input.medusaResponse as Record<string, unknown>,
      staff_review_job_id: input.staffReviewJobId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  return (data as { id?: string } | null)?.id ?? null;
}
