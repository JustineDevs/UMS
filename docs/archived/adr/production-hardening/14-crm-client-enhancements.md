# ADR Plan PH-14 — CRM client enhancements

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 14 |
| **Tier** | T3 Medium |

## Context

`CrmClientEnhancements.tsx` extends CRM views. If enhancements are stubs, the product name "CRM" overclaims.

## Decision (target state)

Ship specific enhancements (segments, notes, tasks) with persistence, **or** rename surface to "Customers" and remove enhancement stubs.

## Concrete plan

1. List each enhancement panel and its backing API.
2. Implement smallest valuable enhancement first (e.g. staff notes with audit).
3. Add RBAC for PII-heavy actions.
4. Update navigation label to match reality.

## Acceptance criteria

- Every visible button either works or is hidden.
- Export or DSAR paths respected for customer PII.

## Rollback

Hide enhancement panels via feature flag.
