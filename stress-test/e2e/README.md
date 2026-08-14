# Universal Music Store E2E stress harness

Playwright `testDir` is this folder (see root `playwright.config.ts`). Layout:

| Path | Role |
|------|------|
| `fixtures/` | URLs, strict flags, worker seed helpers |
| `factories/` | Labels and worker-scoped ids |
| `scenarios/registry.ts` | Scenario metadata and `@tag` constants |
| `manifests/*.json` | Route, layout, component, workflow coverage maps |
| `helpers/` | Storefront, checkout, artifacts, network chaos, viewports, parallel pages |
| `workflows/*.workflow.ts` | Composable steps (checkout, cross-app, storefront journeys) |
| `workflows/*.spec.ts` | Harness specs (checkout-harness, chaos, cross-app-sync) |
| `layouts/` | Viewport and shell stress |
| `components/` | UI surface matrix (chained checkout toggles, PDP, admin shell) |
| `flows/` | Legacy flow specs (PSP, admin ops, HTTP matrix) |
| `runtime-logs-init.ts` | Side-effect import registers global `browser-runtime.log` hooks (imported from shared helpers + a few bare specs) |
| `reporters/` | Runtime log reporter (worker stdio + NDJSON events) |
| `smoke/`, `dogfood/`, `integration/` | Focused suites |

## Tags (grep)

Use Playwright grep on scenario tags embedded in `test.describe` / test titles:

| Tag | Intent |
|-----|--------|
| `@smoke` | Fast health and shell checks |
| `@workflow` | Multi-step user journeys |
| `@checkout` | Cart and checkout affordances |
| `@admin` | Staff app (needs E2E auth when applicable) |
| `@cross-app` | Storefront + admin probes |
| `@layout` | Shell / viewport / navigation |
| `@matrix` | Component / surface permutations |
| `@chaos` | Injected latency / aborted APIs |
| `@architecture` | 13-scenario commerce architecture file |
| `@resilience` | Degraded network |

## Commands (from repo root)

| Goal | Command |
|------|---------|
| All E2E | `pnpm test:e2e` |
| Smoke only | `pnpm test:e2e:smoke` |
| Workflow-tagged | `pnpm test:e2e:workflow` |
| Checkout-focused | `pnpm test:e2e:checkout` |
| Multi-PSP stress journey | `pnpm test:e2e:stress` (see env below) |
| Admin-focused | `pnpm test:e2e:admin` |
| Layout + component matrix dirs | `pnpm test:e2e:matrix` |
| Chaos / resilience | `pnpm test:e2e:chaos` |
| Cross-app HTTP + optional orders shell | `pnpm test:e2e:cross-app` |
| Higher parallelism | `pnpm test:e2e:parallel` |
| Single file | `node stress-test/scripts/run-e2e.js stress-test/e2e/universal-music-store-commerce-architecture.spec.ts` |
| Single tag | `node stress-test/scripts/run-e2e.js --grep @layout` |
| UI mode | `pnpm test:e2e:ui` |

## End-to-end stress journey (`end-to-end-stress-journey.spec.ts`)

Runs Stripe, PayPal, Xendit, and COD (unless `E2E_STRESS_EXCLUDE_COD=1`) for `E2E_STRESS_ITERATIONS` each. Requires **storefront customer auth** for add-to-bag: save Playwright `storageState` after a real Google sign-in and set `PLAYWRIGHT_STOREFRONT_STORAGE_STATE` to that JSON path.

| Variable | Effect |
|----------|--------|
| `PLAYWRIGHT_STOREFRONT_STORAGE_STATE` | Customer session (required for PDP add-to-bag) |
| `E2E_STRICT_PAYMENTS=1` / `E2E_STRICT_E2E=1` | Missing PSP env throws instead of skip |
| `E2E_EXPECT_ALL_PSPS=1` | Every provider enabled in Medusa `payment-health` must have matching `E2E_*` keys |
| `E2E_STRESS_ITERATIONS` | Repeat count per provider (default 1, max 50) |
| `E2E_STRESS_PARALLEL=1` | Parallel tests (higher cart collision risk) |
| `E2E_VERIFY_MEDUSA_ORDER=1` | After redirect, `GET /admin/orders/:id` with `MEDUSA_SECRET_API_KEY` or `E2E_MEDUSA_ADMIN_SECRET` |

PSP sandbox keys match the existing PSP specs (`E2E_STRIPE_API_KEY`, `E2E_PAYPAL_CLIENT_ID` + `E2E_PAYPAL_CLIENT_SECRET`, `E2E_XENDIT_SECRET_KEY`, etc.).

## Artifacts

- Screenshots: failure only by default (`playwright.config.ts`).
- Traces: default `retain-on-failure`. Set `E2E_TRACE=all` (or `on`) for a trace on every test, `E2E_TRACE=off` to disable.
- Output dir: `stress-test/test-results/`, HTML report: `stress-test/playwright-report/`.

### Raw runtime logs (full CLI + workers + browser)

`pnpm test:e2e` runs `stress-test/scripts/run-e2e.js`, which sets `E2E_RUNTIME_LOG_DIR` and writes **complete** Playwright CLI output to:

`stress-test/test-results/runtime-logs/<runId>/playwright-cli-raw.log`

The custom reporter writes to the **same** folder:

| File | Contents |
|------|----------|
| `playwright-worker-stdio.log` | Raw test worker stdout/stderr (`console.log` from tests, assertion output, worker errors) |
| `test-events.ndjson` | One JSON object per line: run begin/end, each test begin/end with status, duration, serialized error, attachment paths |
| `global-errors.log` | `reporter.onError` (unhandled worker exceptions) |
| `RUN_META.json` | Start time, cwd, test count |

Each test also gets `browser-runtime.log` under that test’s Playwright output dir (console at all levels, `pageerror`, failed requests, HTTP status >= 400), unless you set `E2E_BROWSER_RUNTIME_LOG=0`.

Running `pnpm exec playwright test` without the wrapper still creates a timestamped directory under `stress-test/test-results/runtime-logs/`, but **no** `playwright-cli-raw.log` (nothing tees the CLI). Use the wrapper when you need the full terminal transcript on disk.

## Admin E2E

Same as parent `stress-test/README.md`: `ADMIN_ALLOWED_EMAILS`, `NEXTAUTH_SECRET`, `pnpm e2e:ensure-staff`, `/sign-in/e2e`.
