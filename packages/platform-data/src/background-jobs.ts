import type { SupabaseClient } from "@supabase/supabase-js";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type BackgroundJob = {
  id?: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
  created_by?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  attempts?: number;
  next_run_at?: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
  last_error?: string | null;
};

export async function enqueueJob(
  supabase: SupabaseClient,
  jobType: string,
  payload: Record<string, unknown>,
  createdBy?: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      job_type: jobType,
      payload,
      status: "queued" as JobStatus,
      progress: 0,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[jobs] enqueue failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  progress: number,
): Promise<void> {
  await supabase
    .from("background_jobs")
    .update({ progress: Math.min(100, Math.max(0, progress)), status: "running" as JobStatus })
    .eq("id", jobId);
}

export async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("background_jobs")
    .update({
      status: "completed" as JobStatus,
      progress: 100,
      result,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("background_jobs")
    .update({
      status: "failed" as JobStatus,
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function listJobs(
  supabase: SupabaseClient,
  options?: { status?: JobStatus; limit?: number; jobType?: string },
): Promise<BackgroundJob[]> {
  let query = supabase
    .from("background_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.jobType) {
    query = query.eq("job_type", options.jobType);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[jobs] list failed:", error.message);
    return [];
  }
  return (data ?? []) as BackgroundJob[];
}

export async function getJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<BackgroundJob | null> {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) return null;
  return data as BackgroundJob;
}

/**
 * Claim one queued job for a worker (optimistic lock). Returns null if none or lost race.
 */
export async function claimNextRunnableJob(
  supabase: SupabaseClient,
  jobType: string,
  workerId: string,
): Promise<BackgroundJob | null> {
  const now = new Date().toISOString();
  const { data: candidates, error: qErr } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("job_type", jobType)
    .eq("status", "queued")
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(1);

  if (qErr || !candidates?.length) return null;
  const row = candidates[0] as BackgroundJob;
  const id = row.id!;
  const attempts = (row.attempts ?? 0) + 1;

  const { data: claimed, error: uErr } = await supabase
    .from("background_jobs")
    .update({
      status: "running" as JobStatus,
      locked_at: now,
      locked_by: workerId,
      started_at: row.started_at ?? now,
      attempts,
    })
    .eq("id", id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (uErr || !claimed) return null;
  return claimed as BackgroundJob;
}

export async function releaseJobFailure(
  supabase: SupabaseClient,
  jobId: string,
  message: string,
  scheduleRetryMs: number,
): Promise<void> {
  const next = new Date(Date.now() + Math.max(5_000, scheduleRetryMs)).toISOString();
  await supabase
    .from("background_jobs")
    .update({
      status: "queued" as JobStatus,
      locked_at: null,
      locked_by: null,
      last_error: message.slice(0, 2000),
      next_run_at: next,
    })
    .eq("id", jobId);
}
