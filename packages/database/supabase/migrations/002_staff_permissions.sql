-- Staff permission grants (Supabase identity). Empty grants for a user means full access (app logic).
create table if not exists public.staff_permission_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, permission_key)
);

create index if not exists idx_staff_permission_grants_user on public.staff_permission_grants(user_id);

alter table public.staff_permission_grants enable row level security;
