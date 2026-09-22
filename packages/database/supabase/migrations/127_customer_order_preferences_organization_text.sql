-- Keep order preferences compatible with the platform organization identity.
-- Organizations use text identifiers (including local and legacy tenant keys),
-- so this column must not coerce those identifiers through PostgreSQL uuid.
ALTER TABLE public.customer_order_preferences
  ALTER COLUMN organization_id TYPE text
  USING organization_id::text;
