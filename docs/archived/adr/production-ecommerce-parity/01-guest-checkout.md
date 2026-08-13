# ADR Plan — Guest checkout

| **Status** | Accepted |
| **Gap #** | 1 |

## Context

Checkout requires NextAuth session (`checkout-client.tsx`). Medusa carts support `email` without a logged-in customer.

## Decision

Introduce a guest path: collect email (and shipping for shippable methods), call `sdk.store.cart.update` with `email`, keep **full profile gate for COD** only if COD needs verified address.

## Concrete plan

1. Add route segment or query `?guest=1` with explicit UX for guest vs account.
2. Reuse existing cart prep; avoid exposing admin keys in browser.
3. Fraud: rate limit guest checkout, optional CAPTCHA later.
4. E2E: guest Stripe test mode order.

## Acceptance criteria

- Guest completes payment without creating NextAuth user.
- COD still requires complete delivery profile per policy.
