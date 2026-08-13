import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "./background-jobs.js";

type ScheduleField = { min: number; max: number; value: number };

function matchesField(raw: string, value: number, min: number, max: number): boolean {
  return raw.split(",").some((part) => {
    const [range, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) return false;
    const [startText, endText] = range === "*" ? [String(min), String(max)] : range.split("-");
    const start = startText === "*" ? min : Number(startText);
    const end = endText == null ? start : Number(endText);
    return Number.isInteger(start) && Number.isInteger(end) && value >= start && value <= end && (value - start) % step === 0;
  });
}

export function campaignScheduleMatches(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const values: ScheduleField[] = [
    { min: 0, max: 59, value: date.getUTCMinutes() },
    { min: 0, max: 23, value: date.getUTCHours() },
    { min: 1, max: 31, value: date.getUTCDate() },
    { min: 1, max: 12, value: date.getUTCMonth() + 1 },
    { min: 0, max: 6, value: date.getUTCDay() },
  ];
  return fields.every((field, index) => matchesField(field, values[index].value, values[index].min, values[index].max));
}

export async function enqueueDueCampaignJobs(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<number> {
  const currentMinute = new Date(now);
  currentMinute.setUTCSeconds(0, 0);
  const { data, error } = await supabase
    .from("campaigns")
    .select("id,organization_id,schedule_cron,last_run_at,is_active")
    .eq("is_active", true)
    .not("schedule_cron", "is", null)
    .limit(200);
  if (error) throw error;

  let queued = 0;
  for (const row of data ?? []) {
    const organizationId = typeof row.organization_id === "string" ? row.organization_id : null;
    const schedule = typeof row.schedule_cron === "string" ? row.schedule_cron : "";
    if (!organizationId) continue;
    // ponytail: scan the cron interval instead of adding a scheduler dependency; the DB unique index is the race-safe dedupe.
    for (let offset = 0; offset <= 5; offset += 1) {
      const minute = new Date(currentMinute.getTime() - offset * 60_000);
      if (!campaignScheduleMatches(schedule, minute)) continue;
      const executionKey = `scheduled:${minute.toISOString()}`;
      if (row.last_run_at && new Date(row.last_run_at).getTime() >= minute.getTime()) continue;
      const { data: existing } = await supabase
        .from("background_jobs")
        .select("id")
        .eq("job_type", "campaign.execute")
        .eq("payload->>campaignId", String(row.id))
        .eq("payload->>executionKey", executionKey)
        .limit(1);
      if (existing?.length) continue;
      const jobId = await enqueueJob(supabase, "campaign.execute", {
        campaignId: String(row.id),
        organizationId,
        executionKey,
      }, "campaign-scheduler");
      if (jobId) queued += 1;
    }
  }
  return queued;
}
