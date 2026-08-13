-- Provider-specific artifacts are auditable without storing secrets or raw card data.
create table if not exists public.payment_provider_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  merchant_identity text not null,
  provider text not null check (provider in ('stripe', 'paypal', 'xendit')),
  artifact_type text not null check (artifact_type in (
    'product', 'price', 'payment_link', 'checkout_session', 'payment_intent',
    'payment_request', 'payment_token', 'authorization', 'capture', 'refund',
    'dispute', 'payout', 'reconciliation'
  )),
  external_id text not null,
  parent_external_id text,
  status text not null default 'pending',
  amount_minor bigint,
  currency text,
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, artifact_type, external_id),
  unique (organization_id, provider, artifact_type, idempotency_key)
);

create index if not exists idx_payment_provider_artifacts_owner
  on public.payment_provider_artifacts(organization_id, merchant_identity, provider, updated_at desc);
create index if not exists idx_payment_provider_artifacts_parent
  on public.payment_provider_artifacts(parent_external_id, provider);

alter table public.payment_provider_artifacts enable row level security;
drop policy if exists payment_provider_artifacts_deny_anon on public.payment_provider_artifacts;
create policy payment_provider_artifacts_deny_anon on public.payment_provider_artifacts
  for all to anon using (false) with check (false);
drop policy if exists payment_provider_artifacts_deny_authenticated on public.payment_provider_artifacts;
create policy payment_provider_artifacts_deny_authenticated on public.payment_provider_artifacts
  for all to authenticated using (false) with check (false);
drop policy if exists payment_provider_artifacts_service_all on public.payment_provider_artifacts;
create policy payment_provider_artifacts_service_all on public.payment_provider_artifacts
  for all to service_role using (true) with check (true);

create or replace function public.set_payment_provider_artifacts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists payment_provider_artifacts_updated_at on public.payment_provider_artifacts;
create trigger payment_provider_artifacts_updated_at
  before update on public.payment_provider_artifacts
  for each row execute function public.set_payment_provider_artifacts_updated_at();
