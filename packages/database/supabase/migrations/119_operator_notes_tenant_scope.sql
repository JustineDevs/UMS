-- Operator notes are organization-owned operational records.
ALTER TABLE public.admin_operator_notes
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_admin_operator_notes_org_entity
  ON public.admin_operator_notes (organization_id, entity_type, entity_id, created_at DESC);
