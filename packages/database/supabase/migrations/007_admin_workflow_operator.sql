-- 007: Admin operational workflow + operator notes (Supabase).
-- Commerce truth remains in Medusa; this stores review/publish workflow overlays and staff notes.

CREATE TABLE IF NOT EXISTS public.admin_entity_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (
    entity_type IN (
      'catalog_product',
      'sales_order',
      'inventory_adjustment',
      'campaign',
      'cms_page'
    )
  ),
  entity_id text NOT NULL,
  state text NOT NULL,
  previous_state text,
  notes text,
  actor_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_entity_workflow_state
  ON public.admin_entity_workflow (entity_type, state);

CREATE TABLE IF NOT EXISTS public.admin_operator_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  body text NOT NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_operator_notes_entity
  ON public.admin_operator_notes (entity_type, entity_id, created_at DESC);

-- Ensure audit_logs exists when migrations run without full seed.sql (aligns with packages/database/supabase/seed.sql).
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resource text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);
