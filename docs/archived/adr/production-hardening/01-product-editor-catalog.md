# ADR Plan PH-01 — Product editor catalog completeness

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 1 |
| **Tier** | T1 Critical |

## Context

Staff catalog editing must not lose variants, prices, inventory links, or media. **Revision 2:** earlier `TODO` counts were inflated by HTML `placeholder` attributes, not code stubs. `ProductEditorForm.tsx` **does** implement create and edit against admin catalog APIs; this ADR now targets **tests and release proof**, not greenfield UI.

See [CORRECTED-AUDIT-AND-OSS-GAPS.md](../../../adr/production-hardening/CORRECTED-AUDIT-AND-OSS-GAPS.md) and [SPEC-VERDICT.md](../../../adr/production-hardening/SPEC-VERDICT.md) Revision 2.

## Decision (target state)

Treat catalog editor as **release-gated**: every mutation path used in operations has automated or scripted verification, and Medusa remains the commerce source of truth.

## Concrete plan

1. Map all save paths in `ProductEditorForm.tsx` to admin API routes and Medusa admin operations (read `apps/admin/src/domain/operations/catalog-operations.ts` and related routes).
2. Add Playwright or integration coverage: create product, edit variant price, attach image, adjust stock, publish.
3. Reconcile audit drift: record actual gap list (if any) in `SPEC-VERDICT.md` after trace.
4. Add observability: structured error on catalog save failure with correlation id (no secrets in logs).

## Acceptance criteria

- No silent failure on save; user sees actionable errors.
- E2E or integration test covers happy path for one configurable product with variant and image.
- `pnpm run check:admin-api-guard` passes for any new routes.

## Rollback

Revert feature flags or route changes; Medusa catalog remains authoritative for recovery.
