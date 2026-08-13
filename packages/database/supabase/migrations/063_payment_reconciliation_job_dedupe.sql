-- Reuse provider reconciliation jobs for repeated tenant/provider/idempotency requests.
create unique index if not exists idx_payment_reconciliation_job_dedupe
  on public.background_jobs (
    job_type,
    ((payload ->> 'organizationId')),
    ((payload ->> 'provider')),
    ((payload ->> 'idempotencyKey'))
  )
  where job_type = 'reconcile_payment';
