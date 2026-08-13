# ADR Plan PH-23 — digital_receipts and pos_voids Medusa reference

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 23 |
| **Tier** | T5 Data integrity |

## Context

`docs/data-ownership.md` documents `medusa_order_id` backfill on `digital_receipts` and `pos_voids`. New inserts that omit `medusa_order_id` break reporting joins.

## Decision (target state)

Database enforces `medusa_order_id IS NOT NULL` for new rows **or** a check constraint pairing `order_id` and `medusa_order_id` consistency; application upserts always set both.

## Concrete plan

1. Audit all insert sites in admin API and POS flows.
2. Add migration `packages/database/supabase/migrations/0xx_require_medusa_order_id_*.sql` with backfill for any legacy nulls remaining.
3. Add runtime assertion helper `assertMedusaOrderRef(payload)` before insert.
4. Unit test mapper functions.

## Acceptance criteria

- Insert without Medusa id fails in CI tests.
- Analytics queries use single column consistently.

## Rollback

Relax constraint migration only if data cleanup impossible (document debt).
