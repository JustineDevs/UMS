# ADR Plan — Back in stock notifications

| **Status** | Accepted |
| **Gap #** | 15 |

## Context

No restock capture on OOS PDP.

## Decision

Email capture per variant; store subscription row; on inventory increase event or scheduled job, send Resend email and mark sent.

## Concrete plan

1. Migration for `stock_notification_subscriptions` (variant_id, email, created_at, sent_at).
2. PDP form; API route; dedupe unique (email, variant_id).
3. Medusa subscriber or admin inventory hook to trigger sends.

## Acceptance criteria

- User receives at most one email per subscription per restock event.
