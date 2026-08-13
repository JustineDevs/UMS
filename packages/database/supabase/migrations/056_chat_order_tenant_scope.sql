alter table public.chat_order_intake add column if not exists organization_id text;
alter table public.chat_order_intake add column if not exists updated_at timestamptz not null default now();
alter table public.chat_order_intake add column if not exists medusa_order_id text;
alter table public.chat_order_intake add column if not exists medusa_order_display_id text;
alter table public.chat_order_intake add column if not exists medusa_order_payment_status text;

create index if not exists idx_chat_order_intake_organization
  on public.chat_order_intake(organization_id, created_at desc);

drop index if exists public.idx_chat_order_intake_idempotency;
create unique index if not exists idx_chat_order_intake_org_idempotency
  on public.chat_order_intake(organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_chat_order_intake_org_medusa_order
  on public.chat_order_intake(organization_id, medusa_order_id)
  where medusa_order_id is not null;

create or replace function public.set_chat_order_intake_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_order_intake_updated_at on public.chat_order_intake;
create trigger chat_order_intake_updated_at
  before update on public.chat_order_intake
  for each row execute function public.set_chat_order_intake_updated_at();
