# ADR Plan PH-11 — POS devices registry

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 11 |
| **Tier** | T2 High |

## Context

`apps/admin/src/app/(dashboard)/admin/devices/page.tsx` manages `pos_devices` via `packages/platform-data` helpers (`upsertDevice`, `heartbeatDevice`, etc.).

## Decision (target state)

Device list reflects Supabase truth; heartbeat timestamps visible; assignment to store or register is consistent with terminal agent env names.

## Concrete plan

1. Trace page data fetch and mutations to API routes; ensure `requireStaffSession` on all.
2. Add optimistic updates with server reconciliation.
3. Document device name must match `TERMINAL_DEVICE_NAME` on agent host.
4. Smoke test: heartbeat API updates `last_seen` (or equivalent column).

## Acceptance criteria

- Unauthorized users cannot upsert devices (guard + RLS if applicable).
- Stale devices show warning in UI based on threshold.

## Rollback

Read-only list mode if mutations unstable.
