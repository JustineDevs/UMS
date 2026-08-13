# ADR Plan PH-18 — Admin API staff guard and log redaction

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 18 |
| **Tier** | T4 Security |

## Context

`pnpm run check:admin-api-guard` enforces session patterns. `docs/security-program.md` lists secret redaction in admin API error logs as ongoing.

## Decision (target state)

CI fails on unguarded routes; centralized error logger scrubs known secret patterns and `Authorization` headers before emit.

## Concrete plan

1. Run `node stress-test/scripts/check-admin-api-staff-guard.mjs` locally; open issues for any hit.
2. Implement `redactForLogs(error: unknown)` helper in `apps/admin/src/lib/` and use in catch blocks of API routes (incremental migration OK if tracked).
3. Add unit tests with fake tokens resembling Medusa and Supabase keys.
4. Extend CI job to run guard on PR.

## Acceptance criteria

- Zero unguarded admin API routes on `main`.
- Spot-check: forced500 logs contain no raw secrets in sample output.

## Rollback

Revert logger wrapper; keep guard script enforcement.
