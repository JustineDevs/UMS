ALTER TABLE public.cms_media
  ADD COLUMN IF NOT EXISTS storage_cleanup_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS storage_cleanup_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_cleanup_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_cleanup_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_cleanup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_cleanup_last_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cms_media_storage_cleanup_status_check'
  ) THEN
    ALTER TABLE public.cms_media
      ADD CONSTRAINT cms_media_storage_cleanup_status_check
      CHECK (storage_cleanup_status IN ('ready', 'pending', 'processing', 'retry', 'complete', 'external'));
  END IF;
END $$;

UPDATE public.cms_media
SET storage_cleanup_status = 'complete'
WHERE deleted_at IS NOT NULL AND storage_cleanup_status = 'ready';

CREATE INDEX IF NOT EXISTS idx_cms_media_storage_cleanup_due
  ON public.cms_media (storage_cleanup_next_attempt_at, deleted_at, id)
  WHERE deleted_at IS NOT NULL AND storage_cleanup_status IN ('pending', 'retry');
