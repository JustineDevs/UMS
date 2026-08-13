# ADR Plan PH-13 — Campaigns vs Medusa promotions

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 13 |
| **Tier** | T3 Medium |

## Context

`docs/data-ownership.md` states campaigns are for **audience and messaging**; price-changing rules belong in Medusa Promotion or Pricing. `campaigns/page.tsx` must not imply checkout discounts without Medusa execution.

## Decision (target state)

UI copy and docs match behavior: **messaging-only** campaigns, **or** a worker applies Medusa promotions when a campaign goes live (explicit, tested).

## Concrete plan

1. Audit campaign save payload and downstream consumers.
2. If executing prices: call Medusa Admin promotion APIs with idempotent campaign id linkage.
3. If messaging-only: rename labels in admin ("Campaigns (email or SMS audiences)") and remove discount language.
4. Add checkout test proving cart totals unchanged by messaging-only mode.

## Acceptance criteria

- No customer sees a lower total solely from legacy campaign row unless Medusa promotion exists.
- Data ownership table in docs matches implementation.

## Rollback

Disable campaign execution worker; Medusa promotions remain.
