# ADR Plan PH-05 — Payment recovery cron (non-optional operations)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 5 |
| **Tier** | T1 Critical |

## Context

`GET /api/cron/finalize-payment-attempts` in the storefront finalizes stuck `payment_attempts`. `render.yaml` shows a curl cron; Vercel `vercel.json` files omit `crons`. Users who pay and close the tab rely on this path.

## Decision (target state)

Every production deployment that uses Stripe or hosted PSP **schedules** this route with `STOREFRONT_PAYMENT_CRON_SECRET`. Release checklist blocks go-live without it.

## Concrete plan

1. Add `crons` entry to `apps/storefront/vercel.json` pointing at `/api/cron/finalize-payment-attempts` with recommended schedule (e.g. every 5 minutes).
2. Update `docs/runbooks/PAYMENT-INTEGRATION.md` with Vercel-specific steps alongside Render.
3. Add monitoring alert on cron401 or 500 spikes.
4. Verify `STOREFRONT_INTERNAL_RECONCILE_SECRET` for admin retry path in same doc.

## Acceptance criteria

- Staging cron invokes route successfully with bearer secret.
- `docs/security-program.md` classifies missing cron as release blocker (not optional).

## Rollback

Remove cron entry; manual finalize via admin payment attempts remains.
