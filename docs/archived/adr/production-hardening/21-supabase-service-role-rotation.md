# ADR Plan PH-21 — Supabase service role key rotation

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 21 |
| **Tier** | T4 Security |

## Context

High-privilege Supabase keys cannot be fully automated without vendor or secrets-manager integration. Compliance still expects a rotation schedule and evidence.

## Decision (target state)

Human-readable rotation calendar (quarterly or monthly) plus runbook steps in `docs/runbooks/secrets-rotation.md`; optional CI warning if `SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT` env timestamp exceeds threshold **when team adopts it**.

## Concrete plan

1. Add rotation runbook section: create new key, dual-write period, swap Vercel or Render env, revoke old key, verify apps.
2. If using Doppler or Vault, link to external procedure instead of inventing fake automation.
3. Optional: add `SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT=ISO8601` to `.env.example` and a small script `scripts/check-key-age.mjs` for local release gate (fails only if env set and stale).

## Acceptance criteria

- Named owner for rotation on call.
- Incident playbook if key leaks.

## Blocking note

Full automated enforcement is **BLOCKED** without secrets manager API. This ADR ships process plus optional timestamp guard only.
