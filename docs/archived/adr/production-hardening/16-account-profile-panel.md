# ADR Plan PH-16 — Storefront account profile panel

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 16 |
| **Tier** | T3 Medium |

## Context

`AccountProfilePanel.tsx` must keep Medusa customer and Supabase platform profile aligned so checkout `profileGate` passes and deliveries succeed.

## Decision (target state)

Name, phone, and addresses persist through documented APIs; optimistic UI with server reconciliation; errors mapped to field-level validation.

## Concrete plan

1. Trace each save handler to `/api/account/*` or Medusa SDK usage.
2. Add integration tests for profile PATCH routes.
3. E2E: incomplete profile blocks checkout, complete profile unblocks.
4. Ensure Philippine address fields match onboarding schema.

## Acceptance criteria

- No silent discard of user edits on network failure.
- Medusa customer id linkage stable across sessions.

## Rollback

Disable inline edits; deep-link to onboarding only (temporary).
