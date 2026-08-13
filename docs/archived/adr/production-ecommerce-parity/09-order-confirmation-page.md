# ADR Plan — Order confirmation page

| **Status** | Accepted |
| **Gap #** | 9 |

## Context

Success flows land on `/track/:orderId`. Users lack a purchase summary page.

## Decision

Add `/checkout/confirmation/[orderId]` (or `/order/[id]/confirmation`) gated by signed token or session, showing lines, totals, address, payment method, next steps.

## Concrete plan

1. Reuse Medusa order fetch server-side with same auth model as track page.
2. Redirect payment returns to confirmation then link to tracking.
3. E2E: complete test order and assert confirmation content.

## Acceptance criteria

- Page does not leak other customers orders.
