-- Durable POS command boundary. Medusa owns the order; this records the command
-- claim so reconnects and process crashes cannot blindly create another order.
CREATE TABLE IF NOT EXISTS public.pos_sale_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  idempotency_key text NOT NULL,
  offline_sale_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'committed')),
  medusa_order_id text,
  order_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, offline_sale_id)
);
ALTER TABLE public.pos_sale_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_sale_commands_service_all ON public.pos_sale_commands;
CREATE POLICY pos_sale_commands_service_all ON public.pos_sale_commands FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.pos_sale_ledger
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';
ALTER TABLE public.pos_sale_ledger
  DROP CONSTRAINT IF EXISTS pos_sale_ledger_payment_method_check;
ALTER TABLE public.pos_sale_ledger
  ADD CONSTRAINT pos_sale_ledger_payment_method_check CHECK (payment_method IN ('cash', 'card', 'wallet'));
