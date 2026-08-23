import type { SupabaseClient } from "@supabase/supabase-js";

export type SettlementReconciliationStatus =
  | "queued" | "fetching_provider_data" | "matched" | "discrepancy"
  | "needs_review" | "resolved" | "failed";

export type SettlementMatchInput = {
  providerExternalId: string;
  providerPaymentExternalId: string | null;
  expectedPaymentExternalId: string | null;
  expectedOrderId: string | null;
  providerOrderId: string | null;
  expectedAmountMinor: number | null;
  providerAmountMinor: number | null;
  expectedCurrency: string | null;
  providerCurrency: string | null;
  providerStatus: string;
};

export function reconcileSettlement(input: SettlementMatchInput): {
  status: Extract<SettlementReconciliationStatus, "matched" | "discrepancy" | "needs_review">;
  mismatchReason: string | null;
} {
  const mismatches: string[] = [];
  if (!input.providerExternalId.trim()) mismatches.push("provider_external_id_missing");
  if (!input.providerPaymentExternalId || !input.expectedPaymentExternalId || input.providerPaymentExternalId !== input.expectedPaymentExternalId) mismatches.push("payment_reference_mismatch");
  if (!input.providerOrderId || !input.expectedOrderId || input.providerOrderId !== input.expectedOrderId) mismatches.push("order_reference_mismatch");
  if (input.providerAmountMinor == null || input.expectedAmountMinor == null || input.providerAmountMinor !== input.expectedAmountMinor) mismatches.push("amount_mismatch");
  if (!input.providerCurrency || !input.expectedCurrency || input.providerCurrency.toUpperCase() !== input.expectedCurrency.toUpperCase()) mismatches.push("currency_mismatch");
  if (!["succeeded", "completed", "captured", "paid"].includes(input.providerStatus.toLowerCase())) mismatches.push("provider_not_settled");
  if (!mismatches.length) return { status: "matched", mismatchReason: null };
  const hardMismatch = mismatches.some((reason) => reason.endsWith("mismatch") || reason.endsWith("missing"));
  return { status: hardMismatch ? "discrepancy" : "needs_review", mismatchReason: mismatches.join(",") };
}

export async function recordSettlementReconciliation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    provider: "stripe" | "paypal" | "xendit";
    merchantIdentity: string;
    externalId: string;
    artifactType: "balance_transaction" | "payout" | "settlement" | "refund" | "dispute";
    paymentExternalId?: string | null;
    medusaOrderId?: string | null;
    amountMinor?: number | null;
    feeMinor?: number;
    netMinor?: number | null;
    currency?: string | null;
    status: SettlementReconciliationStatus;
    providerOccurredAt?: string | null;
    idempotencyKey: string;
    mismatchReason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const organizationId = input.organizationId.trim();
  const externalId = input.externalId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!organizationId || !externalId || !idempotencyKey) throw new Error("organizationId, externalId, and idempotencyKey are required");
  const { data, error } = await supabase
    .from("payment_settlement_records")
    .upsert({
      organization_id: organizationId,
      provider: input.provider,
      merchant_identity: input.merchantIdentity.trim(),
      external_id: externalId,
      artifact_type: input.artifactType,
      payment_external_id: input.paymentExternalId ?? null,
      medusa_order_id: input.medusaOrderId ?? null,
      amount_minor: input.amountMinor ?? null,
      fee_minor: input.feeMinor ?? 0,
      net_minor: input.netMinor ?? null,
      currency: input.currency?.trim().toUpperCase() ?? null,
      status: input.status,
      provider_occurred_at: input.providerOccurredAt ?? null,
      idempotency_key: idempotencyKey,
      mismatch_reason: input.mismatchReason ?? null,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider,artifact_type,external_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
