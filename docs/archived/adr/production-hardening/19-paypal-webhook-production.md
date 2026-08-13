# ADR Plan PH-19 — PayPal webhook ID in production

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 19 |
| **Tier** | T4 Security |

## Context

`apps/medusa/src/loaders/validate-process-env.ts` requires `PAYPAL_WEBHOOK_ID` in production when PayPal client credentials are set. Tests cover behavior. Operators must still provision the webhook in PayPal dashboard.

## Decision (target state)

Production deploy checklist includes PayPal webhook id verification; health route reports webhook readiness.

## Concrete plan

1. Confirm `payment-health` admin route surfaces PayPal webhook status (already references env).
2. Add predeploy script or `pnpm preflight:checkout-payment-matrix` step in release gate when PayPal enabled.
3. Document dashboard steps in `docs/runbooks/PAYMENT-INTEGRATION.md` with screenshots or deep links.

## Acceptance criteria

- Medusa fails fast at boot in production if PayPal enabled and webhook id missing.
- Staging uses sandbox webhook id distinct from production.

## Rollback

Disable PayPal provider in Medusa config (operational).
