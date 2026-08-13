-- Prevent duplicate scheduled campaign jobs when two cron invocations overlap.
create unique index if not exists idx_campaign_execute_schedule_dedupe
  on public.background_jobs (
    job_type,
    ((payload ->> 'campaignId')),
    ((payload ->> 'executionKey'))
  )
  where job_type = 'campaign.execute';
