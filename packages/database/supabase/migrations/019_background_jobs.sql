CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  result jsonb,
  error text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.background_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.background_jobs (job_type, created_at DESC);

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.background_jobs;
CREATE POLICY "service_role_full_access" ON public.background_jobs
  FOR ALL USING (auth.role() = 'service_role');
