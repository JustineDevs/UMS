alter table public.chat_order_intake
  add column if not exists payment_provider text,
  add column if not exists payment_external_id text,
  add column if not exists payment_status text,
  add column if not exists payment_settled_at timestamptz,
  add column if not exists payment_last_error text;

alter table public.chat_order_intake
  drop constraint if exists chat_order_intake_payment_provider_check;

alter table public.chat_order_intake
  add constraint chat_order_intake_payment_provider_check
  check (payment_provider is null or payment_provider in ('stripe', 'paypal', 'xendit'));

create unique index if not exists idx_chat_order_intake_org_provider_payment
  on public.chat_order_intake(organization_id, payment_provider, payment_external_id)
  where payment_provider is not null and payment_external_id is not null;

create index if not exists idx_chat_order_intake_payment_status
  on public.chat_order_intake(organization_id, payment_status, created_at desc);
