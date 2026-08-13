# ADR Plan PH-10 — Loyalty admin surface (complete or remove)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 10 |
| **Tier** | T2 High |

## Context

`apps/admin/src/app/(dashboard)/admin/loyalty/page.tsx` exposes loyalty UX. `docs/data-ownership.md` requires a **single** balance model. A stub-only page violates ZSPS anti-laziness rules.

## Decision (target state)

**Either** wire ledger reads and writes to Supabase tables with RBAC and audit, **or** remove the route and navigation entry and update docs to state loyalty is not shipped.

## Concrete plan

1. Product decision with item 22 ADR (canonical ledger).
2. If shipping: implement API routes for balance adjust, history list, and idempotent earn or burn tied to `medusa_customer_id`.
3. If not shipping: delete page, remove nav, grep for "loyalty" in marketing copy.
4. Tests for whichever path.

## Acceptance criteria

- No admin URL renders placeholder-only loyalty.
- Checkout integration matches chosen ledger (see checkout loyalty field behavior).

## Rollback

Restore route from git if removal was mistaken.
