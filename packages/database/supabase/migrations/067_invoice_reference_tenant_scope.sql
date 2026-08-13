DROP INDEX IF EXISTS public.admin_invoices_reference_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS admin_invoices_organization_reference_key
  ON public.admin_invoices (organization_id, reference_number);
