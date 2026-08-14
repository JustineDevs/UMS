-- Inbound multi-channel events and chat-to-order queue (platform metadata; Medusa remains commerce SoR).
create table if not exists public.channel_sync_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb default '{}'
);

create index if not exists idx_channel_sync_events_received on public.channel_sync_events(received_at desc);

create table if not exists public.chat_order_intake (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  raw_text text,
  phone text,
  address text,
  items jsonb not null default '[]',
  status text not null default 'pending',
  medusa_draft_order_id text,
  created_at timestamptz not null default now(),
  metadata jsonb default '{}'
);

create index if not exists idx_chat_order_intake_status on public.chat_order_intake(status);
create index if not exists idx_chat_order_intake_created on public.chat_order_intake(created_at desc);

alter table public.channel_sync_events enable row level security;
alter table public.chat_order_intake enable row level security;
