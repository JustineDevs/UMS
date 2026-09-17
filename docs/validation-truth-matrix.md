# Validation Truth Matrix

This matrix defines what a green validation run means in this repository.

## Categories

| Category | Primary commands | What it proves | What it does **not** prove | Ship blocker |
| --- | --- | --- | --- | --- |
| Static / policy / security | `pnpm lint`, `pnpm build`, `pnpm security:check`, boundary scripts in `stress-test/scripts/` | Type/build health, boundary enforcement, obvious policy regressions | Checkout, payment, order, tracking, or POS business truth | Yes |
| Logic / handler / unit | `pnpm test` | Pure logic, handler wiring, idempotency, auth gating, route-level error semantics, webhook parsing and mutation rules covered by tests | Real external PSP/browser completion unless the test explicitly asserts it | Yes |
| Browser critical suites | `pnpm test:e2e:critical` | Explicit browser journeys selected for release confidence; currently catalog browse shell, COD checkout to tracking redirect, API/admin auth smoke | Hosted PSP payment truth unless a suite explicitly asserts signed server-owned completion | Yes when run via `release-gate --include-e2e` |
| Browser exploratory / full suite | `pnpm test:e2e`, `pnpm dogfood:screenshots` | Broader UX coverage, smoke, screenshots, manual QA support | Release truth by itself | No |
| PSP sandbox connectivity | `pnpm test:psp-sandbox`, `psp-sandbox.yml` | Credential/config reachability and selected webhook helper semantics | Order creation, finalization, or customer-visible tracking truth | No |
| Stress / advisory | `pnpm stress-test`, `pnpm test:http-flow` | Extra runtime checks, smoke HTTP matrix, advisory stress coverage | Blocking commerce truth unless promoted into the blocking lanes above | No |

## Blocking truth rules

- `pnpm release-gate` means static and logic-level blockers passed. It does **not** claim hosted payment completion or browser order truth.
- `pnpm release-gate --include-e2e` means:
  - `pnpm release-gate` passed
  - the explicit browser suites in `pnpm test:e2e:critical` passed
- A redirect, return page, or visible confirmation message is not enough. The test must assert server-owned state or route/handler semantics tied to real order/payment/tracking transitions.
- If a critical suite can skip because prerequisites are missing, that suite is not valid release proof for that environment.
- Helper-only webhook tests do not count as route proof. Route or handler-level wiring must be covered for webhook mutation claims.

## Current release-bar intent

For production-readiness claims, green must cover:

- checkout / payment / webhook truth
- POS mutation safety
- tracking propagation correctness

Anything less must be reported as partially proven or unproven.
