import type { SupabaseClient } from "@supabase/supabase-js";

export type RefundLifecycleStatus = "requested" | "pending" | "succeeded" | "failed" | "cancelled";
export type RefundLifecycleRow = { id: string; organization_id: string; refund_id: string; order_id: string; amount_minor: number; currency: string; status: RefundLifecycleStatus; provider_refund_id: string | null; invoice_id: string | null; last_error: string | null; idempotency_key: string; metadata: Record<string, unknown> };
const transitions: Record<RefundLifecycleStatus, readonly RefundLifecycleStatus[]> = { requested: ["pending", "cancelled", "failed"], pending: ["succeeded", "failed"], succeeded: [], failed: ["pending", "cancelled"], cancelled: [] };
export function assertRefundTransition(from: RefundLifecycleStatus | null, to: RefundLifecycleStatus) { if (from && from !== to && !transitions[from].includes(to)) throw new Error(`Invalid refund transition: ${from} -> ${to}`); }
export async function recordRefundLifecycle(supabase: SupabaseClient, input: { organizationId: string; refundId: string; orderId: string; amountMinor: number; currency: string; status: RefundLifecycleStatus; idempotencyKey: string; providerRefundId?: string | null; invoiceId?: string | null; lastError?: string | null; metadata?: Record<string, unknown> }) {
  const organizationId = input.organizationId.trim(), refundId = input.refundId.trim(), orderId = input.orderId.trim(), idempotencyKey = input.idempotencyKey.trim();
  if (!organizationId || !refundId || !orderId || !idempotencyKey) throw new Error("organizationId, refundId, orderId, and idempotencyKey are required");
  const { data, error } = await supabase.rpc("record_refund_lifecycle", { p_organization_id: organizationId, p_refund_id: refundId, p_order_id: orderId, p_amount_minor: input.amountMinor, p_currency: input.currency.trim().toUpperCase(), p_status: input.status, p_idempotency_key: idempotencyKey, p_provider_refund_id: input.providerRefundId?.trim() || null, p_invoice_id: input.invoiceId?.trim() || null, p_last_error: input.lastError ?? null, p_metadata: input.metadata ?? {} });
  if (error) throw error;
  return data as RefundLifecycleRow;
}
