# ADR Plan — Rich order email template

| **Status** | Accepted |
| **Gap #** | 16 |

## Context

`order-placed-resend-email.ts` builds minimal HTML.

## Decision

React Email template with items, prices, totals, shipping address, payment summary, brand header.

## Concrete plan

1. Add template package or colocate under `packages/resend-mail` or Medusa `subscribers/templates`.
2. Load order with items and shipping relations in subscriber.
3. Preview route or story for marketing sign-off.

## Acceptance criteria

- Email renders in major clients; PII matches order snapshot.
