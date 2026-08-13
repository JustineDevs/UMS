# ADR Plan — Admin bulk order operations

| **Status** | Accepted |
| **Gap #** | 18 |

## Context

Orders hub lacks bulk ship, print, status update.

## Decision

Add multi-select with RBAC; batch Medusa Admin API calls with concurrency limit; per-row error report.

## Concrete plan

1. API route `POST /api/admin/orders/bulk-fulfill` or similar with staff guard.
2. UI progress modal; partial success UX.
3. Audit log entries for bulk actions.

## Acceptance criteria

- Failed rows do not roll back successful rows without explicit user choice.
