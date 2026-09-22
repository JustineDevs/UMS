import type { WorkerDatabaseClient } from "./database.ts";

export type RefundProvider = "stripe" | "paypal" | "xendit";
export type RefundAuditState = "completed" | "pending" | "failed";

export type ProviderRefundUpdate = {
  id: string;
  providerStatus: string;
  state: RefundAuditState;
  failure: string | null;
};

export function refundStatusState(provider: RefundProvider, providerStatus: string | null): RefundAuditState {
  const normalized = providerStatus?.trim().toLowerCase();
  if (
    (provider === "stripe" && normalized === "succeeded") ||
    (provider === "paypal" && normalized === "completed") ||
    (provider === "xendit" && normalized === "succeeded")
  ) return "completed";
  if (
    (provider === "stripe" && ["failed", "canceled", "cancelled"].includes(normalized ?? "")) ||
    (provider === "paypal" && ["denied", "failed", "cancelled", "canceled"].includes(normalized ?? "")) ||
    (provider === "xendit" && ["failed", "cancelled", "canceled"].includes(normalized ?? ""))
  ) return "failed";
  return "pending";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function refundResource(provider: RefundProvider, payload: unknown): Record<string, unknown> | null {
  const root = record(payload);
  if (!root) return null;
  return provider === "stripe"
    ? record(record(root.data)?.object)
    : record(root.data) ?? record(root.resource) ?? root;
}

export function providerRefundUpdate(
  provider: RefundProvider,
  eventType: string | null,
  payload: unknown,
): ProviderRefundUpdate | null {
  const type = eventType?.toLowerCase() ?? "";
  const resource = refundResource(provider, payload);
  if (!resource) return null;

  const isRefundEvent = provider === "stripe"
    ? ["refund.created", "refund.updated", "refund.failed", "charge.refund.updated"].includes(type)
    : provider === "xendit"
      ? ["refund.succeeded", "refund.failed"].includes(type)
      : false;
  if (!isRefundEvent) return null;

  const id = string(resource.id) ?? string(resource.refund_id);
  const providerStatus = string(resource.status) ?? (
    provider === "xendit" && type === "refund.succeeded" ? "SUCCEEDED" :
      provider === "xendit" && type === "refund.failed" ? "FAILED" : null
  );
  if (!id || !providerStatus) return null;

  const state = refundStatusState(provider, providerStatus);
  const failure = state === "failed"
    ? string(resource.failure_code) ?? string(resource.failure_reason) ?? providerStatus
    : null;
  return { id, providerStatus, state, failure };
}

export async function applyProviderRefundUpdate(
  database: WorkerDatabaseClient,
  provider: RefundProvider,
  update: ProviderRefundUpdate,
): Promise<boolean> {
  const result = await database.query(
    `UPDATE public.payment_refund_audit
        SET status = $3,
            provider_status = $4,
            completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END,
            result_error = CASE WHEN $3 = 'failed' THEN $5 ELSE NULL END
      WHERE provider = $1
        AND provider_refund_id = $2
        AND status IN ('requested', 'pending', 'processing')`,
    [provider, update.id, update.state, update.providerStatus, update.failure],
  );
  return result.rowCount === 1;
}
