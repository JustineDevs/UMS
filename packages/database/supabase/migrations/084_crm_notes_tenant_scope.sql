-- CRM notes must follow the same organization boundary as deals and activities.
alter table public.staff_customer_notes
  add column if not exists organization_id text;

create index if not exists staff_customer_notes_organization_idx
  on public.staff_customer_notes (organization_id, customer_email, created_at desc);
