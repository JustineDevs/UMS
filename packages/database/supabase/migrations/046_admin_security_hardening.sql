-- Central replay, audit, and device-binding primitives for admin API operations.
-- Runtime code must use the service role for these tables; browser roles are denied.

create table if not exists public.admin_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  action_key text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (actor_key, action_key, idempotency_key)
);

create index if not exists idx_admin_api_idempotency_expiry
  on public.admin_api_idempotency (expires_at);

create table if not exists public.admin_webhook_replays (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  nonce text not null,
  correlation_id text,
  received_at timestamptz not null default now(),
  unique (channel, nonce)
);

create index if not exists idx_admin_webhook_replays_received
  on public.admin_webhook_replays (received_at);

create table if not exists public.admin_step_up_tokens (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  action_key text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  action_key text not null,
  resource_type text,
  resource_id text,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.pos_device_bindings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.pos_devices(id) on delete cascade,
  token_hash text not null unique,
  bound_ip inet,
  bound_profile text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_pos_device_bindings_device
  on public.pos_device_bindings(device_id, is_active);

create unique index if not exists pos_shifts_one_open_employee
  on public.pos_shifts(employee_id)
  where closed_at is null;

alter table public.admin_api_idempotency enable row level security;
alter table public.admin_webhook_replays enable row level security;
alter table public.admin_step_up_tokens enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.pos_device_bindings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['admin_api_idempotency','admin_webhook_replays','admin_step_up_tokens','admin_audit_events','pos_device_bindings'] loop
    execute format('drop policy if exists service_role_only on public.%I', t);
    execute format('create policy service_role_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

create or replace function public.prevent_admin_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'admin audit events are append only';
end;
$$;

drop trigger if exists admin_audit_events_immutable on public.admin_audit_events;
create trigger admin_audit_events_immutable
  before update or delete on public.admin_audit_events
  for each row execute function public.prevent_admin_audit_mutation();
