-- Durable replay guards for external intake and side-effecting campaign sends.
ALTER TABLE public.chat_order_intake
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_order_intake_idempotency
  ON public.chat_order_intake(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'idle'
    CHECK (execution_status IN ('idle', 'running', 'completed', 'failed'));

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS execution_key text;
