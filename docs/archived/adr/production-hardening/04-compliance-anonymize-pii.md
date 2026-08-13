# ADR Plan PH-04 — GDPR or PDPA anonymize stale addresses

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 4 |
| **Tier** | T1 Critical |

## Context

`packages/platform-data/src/compliance.ts` defines `anonymizeStaleOrderAddresses` as a **no-op** returning zero updates. DSAR export exists; right-to-erasure or retention jobs must alter real PII in Supabase where owned.

## Decision (target state)

Batch job nullifies or tokenizes PII fields on `users` and `cart_abandonment_events` (and any other Supabase tables holding addresses) older than policy threshold. Medusa commerce PII handled per Medusa workflows or separate job (document boundary).

## Concrete plan

1. Legal or DPO confirms table list and retention durations.
2. Implement SQL updates via Supabase service role in server-only job (admin API or scheduled worker).
3. Log `compliance_requests` or audit row per batch run (no raw PII in logs).
4. Add unit tests with mocked Supabase client verifying update payloads.

## Acceptance criteria

- Dry-run mode returns counts without writing.
- Live run updates rows and is idempotent for same window.

## Rollback

Disable cron or route; restore from backup if mistaken run (operational procedure).
