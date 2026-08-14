-- RLS for platform tables. Service_role bypasses for Node API.
-- All platform tables: backend-only; no public anon/authenticated read.

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.oauth_accounts enable row level security;
alter table public.compliance_requests enable row level security;
alter table public.compliance_exports enable row level security;
alter table public.retention_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.legacy_import_runs enable row level security;
alter table public.admin_entity_workflow enable row level security;
alter table public.admin_operator_notes enable row level security;
