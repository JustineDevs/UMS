/**
 * Medusa-local Supabase helpers for payment webhooks and health.
 * Duplicates a subset of @universal-music-store/platform-data so Medusa's Node16/CJS
 * backend build does not typecheck the platform-data ESM barrel (TS2835/TS1479).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function isMissingTableOrSchemaError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  if (error.code === "PGRST205") return true;
  if (error.code === "PGRST202") return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("could not find the table") && msg.includes("schema cache")) {
    return true;
  }
  if (msg.includes("relation") && msg.includes("does not exist")) {
    return true;
  }
  return false;
}

function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");

  if (process.env.NODE_ENV === "production") {
    if (!serviceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required in production (anon key bypass is disabled)",
      );
    }
    return createClient(url, serviceKey);
  }

  if (!serviceKey && !anonKey) {
    throw new Error("Missing Supabase credentials (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)");
  }
  if (!serviceKey) {
    console.warn("[medusa] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key (dev only)");
  }
  return createClient(url, serviceKey ?? anonKey!);
}

export function tryCreateSupabaseClient(): SupabaseClient | null {
  try {
    return createSupabaseClient();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[medusa] tryCreateSupabaseClient:", e);
    }
    return null;
  }
}

export type PaymentPlatformMetrics = {
  paymentAttemptsStaleFinalize: number;
  paymentAttemptsNeedsReview: number;
  outboxPendingCount: number;
  jobsQueuedCount: number;
  jobsFailedRecentCount: number;
  webhookEventsUnprocessed: number;
  codDeliveredPendingCapture: number;
  webhookSignatureFailures: number;
  webhookDedupAnomalies: number;
};

export type PaymentPlatformAlert = {
  code:
    | "payment_attempts_stale_finalize"
    | "payment_attempts_needs_review"
    | "payment_webhook_backlog"
    | "outbox_backlog"
    | "background_job_failures"
    | "cod_capture_backlog"
    | "webhook_signature_failures"
    | "webhook_dedup_anomalies";
  severity: "warning" | "critical";
  count: number;
};

export function buildPaymentPlatformAlerts(
  metrics: PaymentPlatformMetrics,
): PaymentPlatformAlert[] {
  const alerts: PaymentPlatformAlert[] = [];
  const add = (
    code: PaymentPlatformAlert["code"],
    count: number,
    severity: PaymentPlatformAlert["severity"],
  ) => {
    if (count > 0) alerts.push({ code, count, severity });
  };

  add("payment_attempts_stale_finalize", metrics.paymentAttemptsStaleFinalize, "critical");
  add("payment_attempts_needs_review", metrics.paymentAttemptsNeedsReview, "warning");
  add(
    "payment_webhook_backlog",
    metrics.webhookEventsUnprocessed,
    metrics.webhookEventsUnprocessed >= 10 ? "critical" : "warning",
  );
  add("outbox_backlog", metrics.outboxPendingCount, "warning");
  add("background_job_failures", metrics.jobsFailedRecentCount, "critical");
  add("cod_capture_backlog", metrics.codDeliveredPendingCapture, "warning");
  add(
    "webhook_signature_failures",
    metrics.webhookSignatureFailures,
    metrics.webhookSignatureFailures >= 3 ? "critical" : "warning",
  );
  add(
    "webhook_dedup_anomalies",
    metrics.webhookDedupAnomalies,
    metrics.webhookDedupAnomalies >= 10 ? "critical" : "warning",
  );
  return alerts;
}

const STALE_STATUSES = ["paid_awaiting_order", "finalizing_order", "paid"];
const RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1_000;

export async function getPaymentPlatformMetrics(
  supabase: SupabaseClient,
): Promise<PaymentPlatformMetrics | null> {
  try {
    const recentFailureSince = new Date(Date.now() - RECENT_FAILURE_WINDOW_MS).toISOString();
    const [stale, needsReview, outbox, jobsQ, jobsF, webhooks, security, codRpc] = await Promise.all([
      supabase
        .from("payment_attempts")
        .select("*", { count: "exact", head: true })
        .in("status", STALE_STATUSES)
        .is("medusa_order_id", null),
      supabase
        .from("payment_attempts")
        .select("*", { count: "exact", head: true })
        .eq("status", "needs_review"),
      supabase.from("outbox_events").select("*", { count: "exact", head: true }).is("processed_at", null),
      supabase.from("background_jobs").select("*", { count: "exact", head: true }).eq("status", "queued"),
      supabase
        .from("background_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("updated_at", recentFailureSince),
      supabase
        .from("payment_webhook_events")
        .select("*", { count: "exact", head: true })
        .is("processed_at", null),
      supabase
        .from("payment_webhook_security_events")
        .select("event_type", { count: "exact", head: true })
        .gte("created_at", recentFailureSince),
      supabase.rpc("count_cod_delivered_pending_capture"),
    ]);

    const err = stale.error ?? needsReview.error;
    if (err && isMissingTableOrSchemaError(err)) return null;
    if (stale.error) throw stale.error;
    if (needsReview.error) throw needsReview.error;
    if (security.error && !isMissingTableOrSchemaError(security.error)) throw security.error;

    let webhookSignatureFailures = 0;
    let webhookDedupAnomalies = 0;
    if (!security.error) {
      const [signature, dedup] = await Promise.all([
        supabase
          .from("payment_webhook_security_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "signature_failure")
          .gte("created_at", recentFailureSince),
        supabase
          .from("payment_webhook_security_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "dedup_duplicate")
          .gte("created_at", recentFailureSince),
      ]);
      webhookSignatureFailures = signature.count ?? 0;
      webhookDedupAnomalies = dedup.count ?? 0;
    }

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
      webhookSignatureFailures,
      webhookDedupAnomalies,
    };
  } catch {
    return null;
  }
}

export async function recordWebhookEvent(
  supabase: SupabaseClient,
  input: {
    provider: string;
    eventId: string;
    eventType?: string;
    payload: Record<string, unknown>;
    correlationId?: string;
    payloadHash?: string | null;
  },
): Promise<{ inserted: boolean; id?: string }> {
  const { data, error } = await supabase
    .from("payment_webhook_events")
    .insert({
      provider: input.provider,
      event_id: input.eventId,
      event_type: input.eventType ?? null,
      payload: input.payload,
      correlation_id: input.correlationId ?? null,
      payload_hash: input.payloadHash ?? null,
      status: "received",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isMissingTableOrSchemaError(error)) return { inserted: false };
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { inserted: false };
    }
    const code = (error as { code?: string }).code;
    if (code === "23505") return { inserted: false };
    throw error;
  }
  return { inserted: Boolean(data?.id), id: data?.id };
}

export async function markWebhookProcessed(
  supabase: SupabaseClient,
  id: string,
  ok: boolean,
  processingError?: string,
): Promise<void> {
  const { error } = await supabase
    .from("payment_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      status: ok ? "processed" : "failed",
      processing_error: processingError ?? null,
    })
    .eq("id", id);
  if (error && !isMissingTableOrSchemaError(error)) throw error;
}

export type PaymentAttemptRow = {
  correlation_id: string;
  provider_payload?: Record<string, unknown> | null;
};

async function getPaymentAttemptByCorrelationId(
  supabase: SupabaseClient,
  correlationId: string,
): Promise<PaymentAttemptRow | null> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("correlation_id", correlationId)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  return (data as PaymentAttemptRow) ?? null;
}

async function updatePaymentAttemptByCorrelationId(
  supabase: SupabaseClient,
  correlationId: string,
  patch: { provider_payload?: Record<string, unknown>; updated_at?: string },
): Promise<void> {
  const { error } = await supabase
    .from("payment_attempts")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("correlation_id", correlationId);
  if (error) throw error;
}

async function mergePaymentAttemptProviderPayload(
  supabase: SupabaseClient,
  correlationId: string,
  merge: Record<string, unknown>,
): Promise<void> {
  const row = await getPaymentAttemptByCorrelationId(supabase, correlationId);
  if (!row) return;
  const prev =
    row.provider_payload && typeof row.provider_payload === "object"
      ? (row.provider_payload as Record<string, unknown>)
      : {};
  await updatePaymentAttemptByCorrelationId(supabase, correlationId, {
    provider_payload: { ...prev, ...merge },
  });
}

export async function findPaymentAttemptByMedusaOrderId(
  supabase: SupabaseClient,
  medusaOrderId: string,
): Promise<PaymentAttemptRow | null> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("medusa_order_id", medusaOrderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    throw error;
  }
  return (data as PaymentAttemptRow) ?? null;
}

export async function mergePaymentAttemptPayloadByMedusaOrderId(
  supabase: SupabaseClient,
  medusaOrderId: string,
  merge: Record<string, unknown>,
): Promise<void> {
  const row = await findPaymentAttemptByMedusaOrderId(supabase, medusaOrderId);
  if (!row) return;
  await mergePaymentAttemptProviderPayload(supabase, row.correlation_id, merge);
}

export const PAYMENT_RECONCILIATION_JOB_TYPES = {
  FINALIZE_CHECKOUT: "finalize_checkout",
  RECONCILE_PAYMENT: "reconcile_payment",
  CAPTURE_COD_PAYMENT: "capture_cod_payment",
  REFUND_PAYMENT: "refund_payment",
  REPAIR_PAYMENT_ATTEMPT: "repair_payment_attempt",
} as const;

export async function enqueueReconciliationJob(
  supabase: SupabaseClient,
  jobType: (typeof PAYMENT_RECONCILIATION_JOB_TYPES)[keyof typeof PAYMENT_RECONCILIATION_JOB_TYPES],
  payload: Record<string, unknown>,
  createdBy?: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      job_type: jobType,
      payload,
      status: "queued",
      progress: 0,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[medusa] enqueue reconciliation job failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}
