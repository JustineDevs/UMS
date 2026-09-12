-- Database-level replay protection for payment finalization. NULL values remain
-- allowed while an attempt is still waiting for a provider artifact.
create unique index if not exists payment_attempts_order_once
  on public.payment_attempts (medusa_order_id)
  where medusa_order_id is not null;

create unique index if not exists payment_attempts_provider_session_once
  on public.payment_attempts (provider, provider_session_id)
  where provider_session_id is not null;

create unique index if not exists payment_attempts_provider_payment_once
  on public.payment_attempts (provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payment_attempts_idempotency_once
  on public.payment_attempts (organization_id, idempotency_key)
  where organization_id is not null and idempotency_key is not null;
