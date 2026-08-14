import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type PaymentPlatformMetrics = {
  paymentAttemptsStaleFinalize: number;
  paymentAttemptsNeedsReview: number;
  outboxPendingCount: number;
  jobsQueuedCount: number;
  jobsFailedRecentCount: number;
  webhookEventsUnprocessed: number;
  /** COD rows where shipment delivery was recorded but ledger not marked captured */
  codDeliveredPendingCapture: number;
};

const STALE_STATUSES = ["paid_awaiting_order", "finalizing_order", "paid"];

export async function getPaymentPlatformMetrics(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<PaymentPlatformMetrics | null> {
  try {
    const scoped = (query: any) =>
      organizationId?.trim() ? query.eq("organization_id", organizationId.trim()) : query;
    const [
      stale,
      needsReview,
      outbox,
      jobsQ,
      jobsF,
      webhooks,
      codRpc,
    ] = await Promise.all([
      scoped(supabase
        .from("payment_attempts")
        .select("*", { count: "exact", head: true })
        .in("status", STALE_STATUSES)
        .is("medusa_order_id", null)),
      scoped(supabase
        .from("payment_attempts")
        .select("*", { count: "exact", head: true })
        .eq("status", "needs_review")),
      supabase
        .from("outbox_events")
        .select("*", { count: "exact", head: true })
        .is("processed_at", null),
      supabase
        .from("background_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "queued"),
      supabase
        .from("background_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("payment_webhook_events")
        .select("*", { count: "exact", head: true })
        .is("processed_at", null),
      supabase.rpc("count_cod_delivered_pending_capture"),
    ]);

    const err = stale.error ?? needsReview.error;
    if (err && isMissingTableOrSchemaError(err)) return null;
    if (stale.error) throw stale.error;
    if (needsReview.error) throw needsReview.error;

    return {
      paymentAttemptsStaleFinalize: stale.count ?? 0,
      paymentAttemptsNeedsReview: needsReview.count ?? 0,
      outboxPendingCount: outbox.count ?? 0,
      jobsQueuedCount: jobsQ.count ?? 0,
      jobsFailedRecentCount: jobsF.count ?? 0,
      webhookEventsUnprocessed: webhooks.count ?? 0,
      codDeliveredPendingCapture: codRpc.error
        ? 0
        : typeof codRpc.data === "number"
          ? codRpc.data
          : Number(codRpc.data ?? 0) || 0,
    };
  } catch {
    return null;
  }
}
