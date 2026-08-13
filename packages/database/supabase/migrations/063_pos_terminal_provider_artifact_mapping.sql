-- Bind provider terminal artifacts to POS devices without storing terminal secrets.
alter table public.payment_provider_artifacts
  drop constraint if exists payment_provider_artifacts_artifact_type_check;

alter table public.payment_provider_artifacts
  add constraint payment_provider_artifacts_artifact_type_check
  check (artifact_type in (
    'product', 'price', 'terminal', 'payment_link', 'invoice', 'checkout_session',
    'payment_intent', 'payment_request', 'payment_token', 'authorization',
    'capture', 'refund', 'dispute', 'payout', 'reconciliation'
  ));

alter table public.pos_payment_terminals
  add column if not exists provider_terminal_external_id text,
  add column if not exists payment_provider_artifact_id uuid
    references public.payment_provider_artifacts(id) on delete set null;

create unique index if not exists pos_payment_terminals_org_provider_external_key
  on public.pos_payment_terminals (organization_id, provider_terminal_external_id);

create index if not exists idx_pos_payment_terminals_provider_artifact
  on public.pos_payment_terminals (payment_provider_artifact_id)
  where payment_provider_artifact_id is not null;
