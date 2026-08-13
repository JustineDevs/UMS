# ADR Plan — Checkout promotion code

| **Status** | Accepted |
| **Gap #** | 14 |

## Context

Medusa promotions exist; checkout UI has loyalty points only.

## Decision

Add promo code field; apply via Medusa Store cart promotions API; show line-level discount in authoritative totals panel.

## Concrete plan

1. Server route to apply code if client must not hold secrets.
2. Map Medusa errors to user-visible messages.
3. E2E with seeded promotion.

## Acceptance criteria

- Invalid code does not corrupt cart; valid code updates Medusa total.
