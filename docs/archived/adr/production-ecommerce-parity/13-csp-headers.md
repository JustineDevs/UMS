# ADR Plan — Content-Security-Policy

| **Status** | Accepted |
| **Gap #** | 13 |

## Context

Storefront and admin set security headers but no CSP.

## Decision

Roll out CSP: start `Content-Security-Policy-Report-Only`, then enforce. Include Stripe, PayPal, Medusa, Supabase, image hosts.

## Concrete plan

1. Inventory all third-party script and connect-src needs from checkout and admin.
2. Add headers in `next.config.js` / `next.config.mjs`.
3. Fix violations; document nonce strategy if inline scripts required.

## Acceptance criteria

- Checkout completes with CSP enforced in staging.
