import { withWorkerTransaction, type WorkerDatabaseClient, type WorkerDatabaseEnv } from "./database.ts";

type ScheduledCampaign = {
  id: string;
  organization_id: string;
  schedule_cron: string;
  last_run_at: string | null;
};

type CampaignJob = {
  id: string;
  payload: unknown;
  attempts: number;
};

type CampaignPayload = { campaignId: string; organizationId: string; executionKey: string };
type CampaignEnv = WorkerDatabaseEnv & {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM?: string;
};

const MAX_CAMPAIGNS_PER_SWEEP = 200;
const MAX_RECIPIENTS_PER_JOB = 20;
const MAX_JOB_ATTEMPTS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cronFieldMatches(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((part) => {
    const [range, stepText] = part.split("/");
    if (stepText !== undefined && (!/^\d+$/.test(stepText) || Number(stepText) < 1)) return false;
    const [startText, endText] = range === "*" ? [String(min), String(max)] : range.split("-");
    const start = startText === "*" ? min : Number(startText);
    const end = endText === undefined ? start : Number(endText);
    const step = stepText === undefined ? 1 : Number(stepText);
    return Number.isInteger(start) && Number.isInteger(end) && start >= min && end <= max && start <= end && value >= start && value <= end && (value - start) % step === 0;
  });
}

export function campaignScheduleMatches(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const values = [date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay()];
  const bounds: ReadonlyArray<readonly [number, number]> = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
  return fields.every((field, index) => cronFieldMatches(field, values[index], bounds[index][0], bounds[index][1]));
}

function parseCampaignPayload(value: unknown): CampaignPayload | null {
  if (!isRecord(value)) return null;
  const { campaignId, organizationId, executionKey } = value;
  if (typeof campaignId !== "string" || campaignId.length > 100 ||
      typeof organizationId !== "string" || organizationId.length > 200 ||
      typeof executionKey !== "string" || executionKey.length > 200) return null;
  return { campaignId, organizationId, executionKey };
}

async function enqueueScheduledCampaigns(app: WorkerDatabaseClient, now: Date): Promise<number> {
  const result = await app.query<ScheduledCampaign>(
    `SELECT id::text, organization_id, schedule_cron, last_run_at::text
     FROM public.campaigns
     WHERE is_active = true AND schedule_cron IS NOT NULL AND organization_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.background_jobs AS job
         WHERE job.job_type='campaign.execute' AND job.payload->>'campaignId'=campaigns.id::text
           AND job.status IN ('queued','running')
       )
     ORDER BY created_at ASC LIMIT $1`,
    [MAX_CAMPAIGNS_PER_SWEEP],
  );
  const minute = new Date(now);
  minute.setUTCSeconds(0, 0);
  let scheduled = 0;
  for (const campaign of result.rows) {
    for (let offset = 0; offset <= 5; offset += 1) {
      const scheduledAt = new Date(minute.getTime() - offset * 60_000);
      if (!campaignScheduleMatches(campaign.schedule_cron, scheduledAt)) continue;
      const executionKey = `scheduled:${scheduledAt.toISOString()}`;
      if (campaign.last_run_at && Date.parse(campaign.last_run_at) >= scheduledAt.getTime()) continue;
      const inserted = await withWorkerTransaction(app, async (transaction) => {
        const locked = await transaction.query<{ id: string; last_run_at: string | null; execution_status: string }>(
          "SELECT id::text, last_run_at::text, execution_status FROM public.campaigns WHERE id=$1 AND organization_id=$2 AND is_active=true FOR UPDATE",
          [campaign.id, campaign.organization_id],
        );
        const row = locked.rows[0];
        if (!row || row.execution_status === "running" || row.last_run_at && Date.parse(row.last_run_at) >= scheduledAt.getTime()) return false;
        const existing = await transaction.query<{ id: string }>(
          `SELECT id::text FROM public.background_jobs
           WHERE job_type='campaign.execute' AND payload->>'campaignId'=$1 AND payload->>'executionKey'=$2 LIMIT 1`,
          [campaign.id, executionKey],
        );
        if (existing.rows[0]) return false;
        const claimed = await transaction.query<{ id: string }>(
          `UPDATE public.campaigns SET execution_key=$3, execution_status='running'
           WHERE id=$1 AND organization_id=$2 AND execution_status <> 'running' RETURNING id::text`,
          [campaign.id, campaign.organization_id, executionKey],
        );
        if (!claimed.rows[0]) return false;
        const job = await transaction.query<{ id: string }>(
          `INSERT INTO public.background_jobs (job_type,payload,status,progress,created_by)
           VALUES ('campaign.execute',$1::jsonb,'queued',0,'campaign-scheduler')
           ON CONFLICT DO NOTHING RETURNING id::text`,
          [JSON.stringify({ campaignId: campaign.id, organizationId: campaign.organization_id, executionKey })],
        );
        return Boolean(job.rows[0]);
      });
      if (inserted) scheduled += 1;
    }
  }
  return scheduled;
}

async function claimCampaignJob(app: WorkerDatabaseClient): Promise<CampaignJob | null> {
  const result = await app.query<CampaignJob>(
    `WITH candidate AS (
       SELECT id FROM public.background_jobs
       WHERE job_type='campaign.execute'
         AND ((status='queued' AND locked_at IS NULL AND (next_run_at IS NULL OR next_run_at <= now()))
           OR (status='running' AND locked_at < now() - interval '10 minutes'))
       ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE public.background_jobs AS job
     SET status='running', locked_at=now(), locked_by='cloudflare-worker',
         started_at=COALESCE(job.started_at,now()), attempts=job.attempts+1
     FROM candidate WHERE job.id=candidate.id
     RETURNING job.id::text, job.payload, job.attempts`,
  );
  return result.rows[0] ?? null;
}

async function failCampaignJob(app: WorkerDatabaseClient, jobId: string, message: string): Promise<void> {
  await app.query(
    `UPDATE public.background_jobs SET status='failed', error=$2, last_error=$2,
       completed_at=now(), locked_at=NULL, locked_by=NULL WHERE id=$1`,
    [jobId, message],
  );
}

async function retryCampaignJob(app: WorkerDatabaseClient, job: CampaignJob): Promise<void> {
  if (job.attempts >= MAX_JOB_ATTEMPTS) {
    const payload = parseCampaignPayload(job.payload);
    if (payload) {
      await app.query(
        `UPDATE public.campaigns SET execution_status='failed'
         WHERE id=$1 AND organization_id=$2 AND execution_key=$3`,
        [payload.campaignId, payload.organizationId, payload.executionKey],
      );
    }
    await failCampaignJob(app, job.id, "Campaign execution exhausted its retry limit");
    return;
  }
  const delaySeconds = Math.min(3600, 60 * 2 ** Math.max(0, job.attempts - 1));
  await app.query(
    `UPDATE public.background_jobs SET status='queued', locked_at=NULL, locked_by=NULL,
       last_error='Campaign execution failed', next_run_at=now()+($2::text || ' seconds')::interval WHERE id=$1`,
    [job.id, delaySeconds],
  );
}

async function executeCampaignBatch(
  app: WorkerDatabaseClient,
  job: CampaignJob,
  env: CampaignEnv,
  fetcher: typeof fetch,
): Promise<{ sent: number; complete: boolean; skipped?: boolean }> {
  const payload = parseCampaignPayload(job.payload);
  if (!payload) {
    await failCampaignJob(app, job.id, "Invalid campaign job payload");
    return { sent: 0, complete: true, skipped: true };
  }
  const campaignResult = await app.query<{
    id: string; organization_id: string; segment_id: string | null; name: string;
    subject: string | null; body_template: string | null; execution_key: string | null;
  }>(
    `SELECT id::text, organization_id, segment_id::text, name, subject, body_template, execution_key
     FROM public.campaigns WHERE id=$1 AND organization_id=$2 AND is_active=true LIMIT 1`,
    [payload.campaignId, payload.organizationId],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign || campaign.execution_key && campaign.execution_key !== payload.executionKey) {
    if (campaign?.execution_key === payload.executionKey) {
      await app.query(
        `UPDATE public.campaigns SET execution_status='failed'
         WHERE id=$1 AND organization_id=$2 AND execution_key=$3`,
        [payload.campaignId, payload.organizationId, payload.executionKey],
      );
    }
    await failCampaignJob(app, job.id, "Campaign execution no longer matches the queued request");
    return { sent: 0, complete: true, skipped: true };
  }
  if (!campaign.segment_id) {
    await app.query("UPDATE public.campaigns SET execution_status='failed' WHERE id=$1 AND organization_id=$2", [campaign.id, payload.organizationId]);
    await failCampaignJob(app, job.id, "Campaign has no segment");
    return { sent: 0, complete: true, skipped: true };
  }
  if (!env.RESEND_API_KEY?.trim()) throw new Error("campaign_delivery_not_configured");

  const recipients = await app.query<{ customer_email: string }>(
    `SELECT DISTINCT lower(trim(member.customer_email)) AS customer_email
     FROM public.customer_segment_members AS member
     JOIN public.marketing_preferences AS preference
       ON lower(trim(preference.email))=lower(trim(member.customer_email))
      AND preference.organization_id=member.organization_id AND preference.channel='email'
      AND preference.consent_status='subscribed'
     WHERE member.segment_id=$1 AND member.organization_id=$2
       AND trim(member.customer_email) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM public.campaign_messages AS sent
         WHERE sent.campaign_id=$3 AND lower(trim(sent.recipient_email))=lower(trim(member.customer_email))
           AND sent.status='sent'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.campaign_messages AS attempted
         WHERE attempted.campaign_id=$3 AND lower(trim(attempted.recipient_email))=lower(trim(member.customer_email))
           AND attempted.status='failed' AND attempted.metadata->>'execution_key'=$5
       )
     ORDER BY lower(trim(member.customer_email)) LIMIT $4`,
    [campaign.segment_id, payload.organizationId, campaign.id, MAX_RECIPIENTS_PER_JOB, payload.executionKey],
  );
  const from = env.RESEND_FROM_EMAIL?.trim() || env.RESEND_FROM?.trim() || "noreply@universal-music-store.com";
  let sent = 0;
  for (const row of recipients.rows) {
    const recipient = row.customer_email.trim().toLowerCase();
    let providerMessageId: string | null = null;
    try {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `campaign:${campaign.id}:${payload.executionKey}:${recipient}`,
        },
        body: JSON.stringify({
          from, to: [recipient], subject: campaign.subject || campaign.name,
          html: campaign.body_template || "",
          tags: [{ name: "type", value: "campaign" }],
        }),
      });
      const result = await response.json().catch(() => ({})) as { id?: unknown };
      if (!response.ok || typeof result.id !== "string") throw new Error("campaign_provider_rejected");
      providerMessageId = result.id;
    } catch {
      await app.query(
        `INSERT INTO public.campaign_messages (campaign_id,recipient_email,status,metadata)
         VALUES ($1,$2,'failed',$3::jsonb)`,
        [campaign.id, recipient, JSON.stringify({ execution_key: payload.executionKey, error: "provider_request_failed" })],
      );
      continue;
    }
    await app.query(
      `INSERT INTO public.campaign_messages (campaign_id,recipient_email,status,metadata)
       VALUES ($1,$2,'sent',$3::jsonb)`,
      [campaign.id, recipient, JSON.stringify({ execution_key: payload.executionKey, provider_message_id: providerMessageId })],
    );
    sent += 1;
  }

  const remaining = await app.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.customer_segment_members AS member
       JOIN public.marketing_preferences AS preference
         ON lower(trim(preference.email))=lower(trim(member.customer_email))
        AND preference.organization_id=member.organization_id AND preference.channel='email'
        AND preference.consent_status='subscribed'
       WHERE member.segment_id=$1 AND member.organization_id=$2
         AND trim(member.customer_email) <> ''
         AND NOT EXISTS (SELECT 1 FROM public.campaign_messages sent
           WHERE sent.campaign_id=$3 AND lower(trim(sent.recipient_email))=lower(trim(member.customer_email)) AND sent.status='sent')
         AND NOT EXISTS (SELECT 1 FROM public.campaign_messages attempted
           WHERE attempted.campaign_id=$3 AND lower(trim(attempted.recipient_email))=lower(trim(member.customer_email))
             AND attempted.status='failed' AND attempted.metadata->>'execution_key'=$4)
     ) AS exists`,
    [campaign.segment_id, payload.organizationId, campaign.id, payload.executionKey],
  );
  const complete = !remaining.rows[0]?.exists;
  if (complete) {
    await app.query(
      `UPDATE public.campaigns SET execution_status='completed', last_run_at=now()
       WHERE id=$1 AND organization_id=$2 AND execution_key=$3`,
      [campaign.id, payload.organizationId, payload.executionKey],
    );
    await app.query(
      `UPDATE public.background_jobs SET status='completed', progress=100,
         result=$2::jsonb, completed_at=now(), locked_at=NULL, locked_by=NULL
       WHERE id=$1`,
      [job.id, JSON.stringify({ sent, campaignId: campaign.id, organizationId: payload.organizationId })],
    );
  } else {
    await app.query(
      `UPDATE public.background_jobs SET status='queued', progress=LEAST(99,progress+1),
         next_run_at=now()+interval '1 minute', locked_at=NULL, locked_by=NULL
       WHERE id=$1`,
      [job.id],
    );
  }
  return { sent, complete };
}

export async function runCampaignSweep(
  app: WorkerDatabaseClient,
  env: CampaignEnv,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<{ processed: number; scheduled: number; sent: number; retrying: boolean; failed: boolean }> {
  const scheduled = await enqueueScheduledCampaigns(app, now);
  const job = await claimCampaignJob(app);
  if (!job) return { processed: 0, scheduled, sent: 0, retrying: false, failed: false };
  try {
    const result = await executeCampaignBatch(app, job, env, fetcher);
    return { processed: 1, scheduled, sent: result.sent, retrying: !result.complete, failed: false };
  } catch {
    await retryCampaignJob(app, job);
    return { processed: 1, scheduled, sent: 0, retrying: job.attempts < MAX_JOB_ATTEMPTS, failed: job.attempts >= MAX_JOB_ATTEMPTS };
  }
}
