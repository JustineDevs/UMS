# ADR Plan PH-07 — Checkout client payment path hardening

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 7 |
| **Tier** | T2 High |

## Context

`checkout-client.tsx` and `use-checkout-client.ts` coordinate profile gate, Medusa totals, embedded PSP, and pending hosted checkout. Any regression is direct revenue risk.

## Decision (target state)

Payment path has **single authoritative total** from Medusa at pay time; buttons disabled until totals ready; correlation ids flow to checkout intents.

## Concrete plan

1. Maintain parity tests between preview cart and payment cart totals (existing `cartToTotalsPreview` path).
2. Add regression tests for `medusaPriceStatus` transitions when `confirmedPreview` arrives.
3. E2E: Stripe and COD in `test:e2e:critical`; extend per item 25 for other PSPs.
4. Review `handlePay` error mapping for user-safe messages (no internal keys).

## Acceptance criteria

- No pay action with `medusaPriceStatus === "loading"` for methods that require Medusa totals.
- Hosted checkout amount matches `confirmedTotal` within one minor unit.

## Rollback

Revert client commit; server routes unchanged.
