DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['pos_fiscal_profiles','pos_terminal_certifications','pos_payment_terminals','pos_shift_reconciliations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id text', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id, created_at DESC)', table_name || '_organization_idx', table_name);
    EXECUTE format($sql$
      UPDATE public.%I target
      SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
      WHERE target.organization_id IS NULL
    $sql$, table_name);
  END LOOP;
END $$;

ALTER TABLE public.pos_fiscal_profiles DROP CONSTRAINT IF EXISTS pos_fiscal_profiles_jurisdiction_registration_number_key;
ALTER TABLE public.pos_terminal_certifications DROP CONSTRAINT IF EXISTS pos_terminal_certifications_certification_id_key;
ALTER TABLE public.pos_payment_terminals DROP CONSTRAINT IF EXISTS pos_payment_terminals_serial_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS pos_fiscal_profiles_org_identity_key
  ON public.pos_fiscal_profiles (organization_id, jurisdiction, registration_number);
CREATE UNIQUE INDEX IF NOT EXISTS pos_terminal_certifications_org_identity_key
  ON public.pos_terminal_certifications (organization_id, certification_id);
CREATE UNIQUE INDEX IF NOT EXISTS pos_payment_terminals_org_identity_key
  ON public.pos_payment_terminals (organization_id, serial_number);
