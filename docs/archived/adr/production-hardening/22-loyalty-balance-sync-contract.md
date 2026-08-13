# ADR Plan PH-22 — Loyalty balance canonical source

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 22 |
| **Tier** | T5 Data integrity |

## Context

`docs/data-ownership.md` forbids two independent loyalty balances without a documented sync contract. Checkout may read points from Supabase while Medusa metadata could diverge.

## Decision (target state)

Accepted ADR names **one** ledger (Supabase `loyalty_accounts` **or** Medusa module) and code removes parallel balances or adds a single reconciliation job with metrics.

## Concrete plan

1. Architecture review with item 10 (admin UI) and checkout redemption path.
2. If Supabase canonical: strip conflicting Medusa metadata writes; document in ADR archive.
3. If Medusa canonical: migrate balances and deprecate Supabase ledger tables safely.
4. Add nightly reconciliation report or assertion test in staging.

## Acceptance criteria

- Single source readable at checkout time.
- Documented failure mode if reconciliation job stops.

## Rollback

Disable loyalty redemption in checkout until contract implemented.
