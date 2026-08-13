# ADR Plan PH-03 — Admin POS page UI wiring

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 3 |
| **Tier** | T1 Critical |

## Context

`apps/admin/src/app/(dashboard)/admin/pos/page.tsx` orchestrates shift UI, cart, voids, and offline sync. `commit-sale` route is referenced as solid; UI must call terminal agent and sync reliably after Medusa success.

## Decision (target state)

POS page actions have **explicit** loading and error surfaces for every network boundary: Medusa lookup, commit sale, print, drawer, offline queue.

## Concrete plan

1. Trace each button handler to its `fetch` target; list gaps (missing `await`, missing error toast).
2. Wire receipt print to terminal agent URL from env (`NEXT_PUBLIC_TERMINAL_AGENT_*` pattern per `AGENTS.md`).
3. Add E2E smoke: open shift (mock API), add line, commit sale in test mode, assert no unhandled rejection.
4. Ensure offline `trySync` surfaces pending count and last sync error to staff.

## Acceptance criteria

- No blank success on failed print; staff sees retry guidance.
- Shift open/close persisted via existing `/api/admin/shifts` contracts.

## Rollback

Feature-flag POS print step; keep Medusa sale path unchanged.
