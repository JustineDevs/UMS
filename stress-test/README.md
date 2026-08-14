# Stress / E2E testing

All Playwright-related tests, reports, and artifacts live under this directory.

## Structure

```
stress-test/
├── e2e/                    # Playwright testDir: specs, manifests, workflows, helpers
│   ├── README.md           # Harness tags, commands, artifact paths
│   ├── manifests/          # route-coverage.json, component-coverage.json, etc.
│   ├── workflows/          # Composable *.workflow.ts + harness *.spec.ts
│   ├── layouts/            # Viewport / shell stress
│   ├── components/         # UI surface matrix
│   ├── fixtures/           # Env + worker seed
│   └── reporters/          # Optional stderr reporter for failures
├── test-results/            # Playwright test artifacts (traces, screenshots)
├── playwright-report/       # HTML test report
├── dogfood-output/         # Dogfood screenshot outputs
├── .playwright-cache/       # Transform cache & temp (EPERM workaround)
└── README.md
```

## Commands

From project root:

### Full stress-test (all phases)

- `pnpm stress-test` — Lint → Security → Audit → Unit/Medusa → E2E → Dogfood
- `pnpm stress-test:quick` — Same but skips E2E and dogfood (no dev servers needed)

### Individual phases

- `pnpm test:e2e` — Run all E2E tests (headless)
- `pnpm test:e2e:smoke` — Grep `@smoke` only
- `pnpm test:e2e:workflow` — Grep `@workflow`
- `pnpm test:e2e:checkout` — Checkout harness + commerce journey + medusa checkout smoke
- `pnpm test:e2e:stress` — Multi-PSP orchestrated journey (see `e2e/README.md`)
- `pnpm test:e2e:admin` — Admin operations flow (`@admin`)
- `pnpm test:e2e:matrix` — `e2e/components` + `e2e/layouts`
- `pnpm test:e2e:chaos` — Network chaos / resilience spec
- `pnpm test:e2e:cross-app` — Cross-app HTTP + optional admin orders shell
- `pnpm test:e2e:parallel` — Same runner with `--workers=4`
- `pnpm test:e2e:ui` — Run Playwright UI mode
- `pnpm test:e2e:report` — Open last HTML report
- `pnpm dogfood:screenshots` — Capture full-page screenshots (storefront + admin)

Focused runs: `node stress-test/scripts/run-e2e.js --grep @layout` or pass a single file. See `stress-test/e2e/README.md`.

### Admin E2E (full stress run)

For `flows/admin-operations-flow.spec.ts` and `flows/admin-e2e-credentials.spec.ts`:

1. Root `.env.local`: `ADMIN_ALLOWED_EMAILS` (first email is the actor), `NEXTAUTH_SECRET` (password on `/sign-in/e2e`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the usual admin/Medusa vars used by `pnpm run dev`.
2. Run `pnpm e2e:ensure-staff` once per environment. If the first email is **staff** in Supabase, the script sets `staff_permission_grants` to `*`. If that user is already **admin**, the script makes no changes (admin sessions already resolve to wildcard permissions).
3. Playwright must target the admin origin: `PLAYWRIGHT_ADMIN_NEXTAUTH_URL=http://localhost:3001` (already defaulted in `playwright.config.ts` for the admin dev server).

### Manual checklist

See `stress-test/checklist.md` for design-with-taste, core-engineering, OWASP review items.

## Output locations

| Output            | Path                               |
|-------------------|------------------------------------|
| Test results      | `stress-test/test-results/`         |
| HTML report       | `stress-test/playwright-report/`    |
| Dogfood screenshots | `stress-test/dogfood-output/screenshots/` |
