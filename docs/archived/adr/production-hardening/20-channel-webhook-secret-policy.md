# ADR Plan PH-20 — Channel webhook secret on all non-dev environments

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 20 |
| **Tier** | T4 Security |

## Context

`apps/admin/src/lib/channel-webhook-policy.ts` gates `CHANNEL_WEBHOOK_SECRET` by environment matrix. Staging on Vercel preview may skip enforcement if policy treats it like dev.

## Decision (target state)

Any deployment that exposes `/api/integrations/channels/webhook` publicly **requires** secret validation except local `development`.

## Concrete plan

1. Enumerate env tuples: local dev, Vercel preview, Vercel production, Render, CI.
2. Adjust policy so `VERCEL_ENV=preview` still requires secret if `CHANNEL_WEBHOOK_ENFORCE_IN_PREVIEW=true` (new flag) or default strict for all non-local.
3. Add unit tests for policy matrix.
4. Update `docs/security-program.md` with the matrix table.

## Acceptance criteria

- Unauthenticated POST to webhook returns 401 in staging.
- No accidental open webhook in preview URLs without secret rotation story.

## Rollback

Loosen policy with explicit env escape hatch documented and time-bounded.
