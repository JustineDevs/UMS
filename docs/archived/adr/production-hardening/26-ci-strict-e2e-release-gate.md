# ADR Plan PH-26 — CI_STRICT_E2E in release gate

| Field | Value |
|-------|--------|
| **Status** | Accepted (observed in CI config for this workflow) |
| **Checklist #** | 26 |
| **Tier** | T6 Release gate |

## Context

`stress-test/e2e/helpers/checkout.ts` skips PSP tests when credentials missing unless strict mode is on. `.github/workflows/e2e-release-gate.yml` sets `CI_STRICT_E2E: "1"` for `pnpm test:e2e:critical`. A separate investigation claimed strict mode was missing; that is **false for this workflow**. Other workflows under `.github/workflows/` currently **do not** run `test:e2e:critical`, so the remaining risk is **future** workflows that run E2E without setting the env.

## Decision (target state)

All workflows that assert release readiness for checkout must set strict mode or explicitly document why they intentionally allow skips.

## Concrete plan

1. Grep `.github/workflows` for `test:e2e` and verify `CI_STRICT_E2E` parity.
2. Add CI lint script `scripts/check-e2e-strict.mjs` optional guard.
3. Document in `stress-test/README.md` the meaning of strict mode for operators.

## Acceptance criteria

- `e2e-release-gate` remains strict as today.
- No duplicate workflow silently runs checkout E2E without strict flag unless named "optional".

## Rollback

Remove strict flag only during emergency pipeline unblock; restore immediately after.
