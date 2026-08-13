# ADR Plan PH-02 — Terminal agent hardware bridge

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 2 |
| **Tier** | T1 Critical |

## Context

`apps/terminal-agent/src/server.ts` exposes print and drawer behavior for POS. Mock adapter is blocked in production unless `ALLOW_MOCK_TERMINAL_ADAPTER=true`. Physical retail needs verified adapters (TCP, relay, QZ, Star CloudPRNT).

## Decision (target state)

Default production profile uses a **real** adapter with documented env matrix. Mock is dev-only or emergency-only with explicit env.

## Concrete plan

1. Document one blessed production profile per deployment (Epson, Star, relay URL) in `apps/terminal-agent/README.md` or runbook.
2. Add health checks: `/health` and `/status` responses include last print error and adapter name (no PII).
3. Smoke script: POST test receipt bytes to `/print` in staging with secret header.
4. Verify `mutatingPostAllowed` and `TERMINAL_AGENT_SECRET` in all environments that expose the agent beyond loopback.

## Acceptance criteria

- Production startup fails fast if mock is selected without override.
- Staging run completes print job to mock directory or test printer without crashing admin POS flow.

## Rollback

Switch adapter env back to mock with override in non-prod only.
