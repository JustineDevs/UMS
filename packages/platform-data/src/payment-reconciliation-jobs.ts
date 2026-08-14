import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueJob } from "./background-jobs.js";
import { upsertPaymentProviderArtifact } from "./payment-provider-artifacts.js";
import type { PaymentProvider } from "./payment-provider-capabilities.js";

/** Job payloads for worker / cron; use with `background_jobs.job_type`. */
export const PAYMENT_RECONCILIATION_JOB_TYPES = {
  FINALIZE_CHECKOUT: "finalize_checkout",
  RECONCILE_PAYMENT: "reconcile_payment",
  CAPTURE_COD_PAYMENT: "capture_cod_payment",
  REFUND_PAYMENT: "refund_payment",
  REPAIR_PAYMENT_ATTEMPT: "repair_payment_attempt",
} as const;

/**
 * Enqueue a payment reconciliation or follow-up job (durable `background_jobs` row).
 */
export async function enqueueReconciliationJob(
  supabase: SupabaseClient,
  jobType: (typeof PAYMENT_RECONCILIATION_JOB_TYPES)[keyof typeof PAYMENT_RECONCILIATION_JOB_TYPES],
  payload: Record<string, unknown>,
  createdBy?: string,
): Promise<string | null> {
  return enqueueJob(supabase, jobType, payload, createdBy);
}

export type ProviderReconciliationRequest = {
  organizationId: string;
  merchantIdentity: string;
  provider: PaymentProvider;
  periodStart: string;
  periodEnd: string;
  idempotencyKey: string;
  createdBy?: string;
};

export type ProviderReconciliationJobRequest = {
  jobId: string | null;
  artifactExternalId: string;
  reused: boolean;
};

async function findProviderReconciliationJob(
  supabase: SupabaseClient,
  input: ProviderReconciliationRequest,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id")
    .eq("job_type", PAYMENT_RECONCILIATION_JOB_TYPES.RECONCILE_PAYMENT)
    .eq("payload->>organizationId", input.organizationId)
    .eq("payload->>provider", input.provider)
    .eq("payload->>idempotencyKey", input.idempotencyKey)
    .limit(1);
  if (error) return null;
  const id = (data?.[0] as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Records a provider reconciliation request without calling provider APIs.
 * The durable background job is keyed by tenant/provider/idempotency payload.
 */
export async function requestProviderReconciliationJob(
  supabase: SupabaseClient,
  input: ProviderReconciliationRequest,
): Promise<ProviderReconciliationJobRequest> {
  const artifactExternalId = `reconciliation:${input.provider}:${input.idempotencyKey}`;
  const existingJobId = await findProviderReconciliationJob(supabase, input);
  if (existingJobId) {
    await upsertPaymentProviderArtifact(supabase, {
      organization_id: input.organizationId,
      merchant_identity: input.merchantIdentity,
      provider: input.provider,
      artifact_type: "reconciliation",
      external_id: artifactExternalId,
      status: "queued",
      idempotency_key: input.idempotencyKey,
      metadata: {
        job_id: existingJobId,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        reused: true,
      },
    });
    return { jobId: existingJobId, artifactExternalId, reused: true };
  }

  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      job_type: PAYMENT_RECONCILIATION_JOB_TYPES.RECONCILE_PAYMENT,
      payload: {
        organizationId: input.organizationId,
        provider: input.provider,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        idempotencyKey: input.idempotencyKey,
      },
      status: "queued",
      progress: 0,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  const jobId =
    !error && typeof (data as { id?: unknown } | null)?.id === "string"
      ? (data as { id: string }).id
      : await findProviderReconciliationJob(supabase, input);

  await upsertPaymentProviderArtifact(supabase, {
    organization_id: input.organizationId,
    merchant_identity: input.merchantIdentity,
    provider: input.provider,
    artifact_type: "reconciliation",
    external_id: artifactExternalId,
    status: jobId ? "queued" : "failed",
    idempotency_key: input.idempotencyKey,
    metadata: {
      job_id: jobId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    },
    last_error: jobId
      ? null
      : error?.message ?? "Unable to enqueue reconciliation job",
  });

  return { jobId, artifactExternalId, reused: Boolean(error && jobId) };
}
