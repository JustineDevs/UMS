# ADR Plan PH-15 — Chat intake and draft orders

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 15 |
| **Tier** | T3 Medium |

## Context

`apps/admin/src/app/api/integrations/chat-orders/intake/route.ts` hardcodes `email: "chat-intake@instore.local"` for draft Medusa cart or customer linkage. That blocks multi-brand and deliverability reality.

## Decision (target state)

Intake identity comes from **`CHAT_INTAKE_EMAIL`** (or `CHAT_INTAKE_CUSTOMER_ID` if Medusa requires) validated in `validate-process-env` for admin app or documented optional default for dev only.

## Concrete plan

1. Add env var to root `.env.example` and admin deployment docs.
2. Replace literal with `process.env.CHAT_INTAKE_EMAIL?.trim()`; fail request in production if unset when feature enabled.
3. Complete UI flows in `ChatIntakeForm.tsx` for line items and customer lookup per product requirements.
4. Unit test env guard.

## Acceptance criteria

- Production never creates drafts with a surprise inbox you do not control.
- Chat operator sees the resolved email in confirmation UI.

## Rollback

Revert to dev-only default behind `NODE_ENV === "development"` check.
