# ADR Plan PH-24 — Cart abandonment recovery email deduplication

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 24 |
| **Tier** | T5 Data integrity |

## Context

`apps/storefront/src/app/api/cart/abandonment/route.ts` limits recovery sends with a 48h count query. Two concurrent requests can still double-send without a database constraint.

## Decision (target state)

Idempotency enforced in Postgres: partial unique index on `(lower(email), date_trunc('day', created_at))` or dedicated `recovery_send_log` with unique key per campaign window, matching product policy.

## Concrete plan

1. Define exact dedup window (48h vs calendar day) with legal or marketing sign-off.
2. Add migration for constraint or log table.
3. Wrap send in transaction: insert log row first, send only on successful insert.
4. Add concurrency test with two parallel fetch calls.

## Acceptance criteria

- Second concurrent request does not enqueue second provider send for same window.
- Metrics show skipped duplicates count in logs.

## Rollback

Drop unique index if provider API rejects mid-migration (unlikely with careful rollout).
