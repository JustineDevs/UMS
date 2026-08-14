-- Deny authenticated (and explicit anon where noted elsewhere) on core platform tables.
-- Service role bypasses RLS for backend APIs. Complements enable_rls.sql + rls_deny_anon_sensitive.sql.

-- ============================================================================
-- 1. staff_permission_grants: deny anon + deny authenticated
-- ============================================================================

drop policy if exists staff_permission_grants_deny_anon on public.staff_permission_grants;
create policy staff_permission_grants_deny_anon
  on public.staff_permission_grants
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists staff_permission_grants_deny_authenticated on public.staff_permission_grants;
create policy staff_permission_grants_deny_authenticated
  on public.staff_permission_grants
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 2. users: deny authenticated (anon deny already exists in rls_deny_anon_sensitive)
-- ============================================================================

drop policy if exists users_deny_authenticated on public.users;
create policy users_deny_authenticated
  on public.users
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 3. user_roles: deny authenticated
-- ============================================================================

drop policy if exists user_roles_deny_authenticated on public.user_roles;
create policy user_roles_deny_authenticated
  on public.user_roles
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 4. staff_profiles: deny authenticated
-- ============================================================================

drop policy if exists staff_profiles_deny_authenticated on public.staff_profiles;
create policy staff_profiles_deny_authenticated
  on public.staff_profiles
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 5. oauth_accounts: deny authenticated
-- ============================================================================

drop policy if exists oauth_accounts_deny_authenticated on public.oauth_accounts;
create policy oauth_accounts_deny_authenticated
  on public.oauth_accounts
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 6. audit_logs: deny authenticated
-- ============================================================================

drop policy if exists audit_logs_deny_authenticated on public.audit_logs;
create policy audit_logs_deny_authenticated
  on public.audit_logs
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 7. compliance_requests: deny authenticated
-- ============================================================================

drop policy if exists compliance_requests_deny_authenticated on public.compliance_requests;
create policy compliance_requests_deny_authenticated
  on public.compliance_requests
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 8. compliance_exports: deny authenticated
-- ============================================================================

drop policy if exists compliance_exports_deny_authenticated on public.compliance_exports;
create policy compliance_exports_deny_authenticated
  on public.compliance_exports
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 9. retention_jobs: deny authenticated
-- ============================================================================

drop policy if exists retention_jobs_deny_authenticated on public.retention_jobs;
create policy retention_jobs_deny_authenticated
  on public.retention_jobs
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 10. admin_entity_workflow: deny authenticated
-- ============================================================================

drop policy if exists admin_entity_workflow_deny_authenticated on public.admin_entity_workflow;
create policy admin_entity_workflow_deny_authenticated
  on public.admin_entity_workflow
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 11. admin_operator_notes: deny authenticated
-- ============================================================================

drop policy if exists admin_operator_notes_deny_authenticated on public.admin_operator_notes;
create policy admin_operator_notes_deny_authenticated
  on public.admin_operator_notes
  for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- 12. legacy_import_runs: deny authenticated
-- ============================================================================

drop policy if exists legacy_import_runs_deny_authenticated on public.legacy_import_runs;
create policy legacy_import_runs_deny_authenticated
  on public.legacy_import_runs
  for all
  to authenticated
  using (false)
  with check (false);
