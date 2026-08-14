-- Deny anon on all platform tables. Backend uses service_role only.

drop policy if exists users_deny_anon on public.users;
create policy users_deny_anon on public.users for all to anon using (false) with check (false);

drop policy if exists user_roles_deny_anon on public.user_roles;
create policy user_roles_deny_anon on public.user_roles for all to anon using (false) with check (false);

drop policy if exists staff_profiles_deny_anon on public.staff_profiles;
create policy staff_profiles_deny_anon on public.staff_profiles for all to anon using (false) with check (false);

drop policy if exists oauth_accounts_deny_anon on public.oauth_accounts;
create policy oauth_accounts_deny_anon on public.oauth_accounts for all to anon using (false) with check (false);

drop policy if exists compliance_requests_deny_anon on public.compliance_requests;
create policy compliance_requests_deny_anon on public.compliance_requests for all to anon using (false) with check (false);

drop policy if exists compliance_exports_deny_anon on public.compliance_exports;
create policy compliance_exports_deny_anon on public.compliance_exports for all to anon using (false) with check (false);

drop policy if exists retention_jobs_deny_anon on public.retention_jobs;
create policy retention_jobs_deny_anon on public.retention_jobs for all to anon using (false) with check (false);

drop policy if exists audit_logs_deny_anon on public.audit_logs;
create policy audit_logs_deny_anon on public.audit_logs for all to anon using (false) with check (false);

drop policy if exists legacy_import_runs_deny_anon on public.legacy_import_runs;
create policy legacy_import_runs_deny_anon on public.legacy_import_runs for all to anon using (false) with check (false);

drop policy if exists admin_entity_workflow_deny_anon on public.admin_entity_workflow;
create policy admin_entity_workflow_deny_anon on public.admin_entity_workflow for all to anon using (false) with check (false);

drop policy if exists admin_operator_notes_deny_anon on public.admin_operator_notes;
create policy admin_operator_notes_deny_anon on public.admin_operator_notes for all to anon using (false) with check (false);
