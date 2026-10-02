# Same-Day Release Board

**Rule:** ALL GREEN = ship. ANY RED = no ship.

**Current status:** `pnpm release-gate` passes. `pnpm release-gate:full` fails on Windows (Medusa ESM boot). **Ship gate has not passed.** Obtain ship proof via CI (`release-gate-full` workflow, manual dispatch or tag push) or manual app start + `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e`.

**Automated proof commands:**
- `pnpm release-gate` — lint, security, audit triage, unit/integration/database/Medusa tests. CI runs this on every PR. Requires Node 20 (`fnm use 20` or `nvm use 20`).
- `pnpm release-gate:full` — above + Playwright starts storefront (3000), admin (3001), Medusa (9000), Express (4000) and runs E2E. Use before same-day ship. Boot and E2E board items are automated by this command. On Windows, Medusa may fail to boot (ESM conflict); use CI or start apps manually and `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e`.

**Automated (formerly manual):** Storefront fail-fast env, Medusa prod env, Express INTERNAL_API_KEY boot, admin non-staff denial, compliance key rejection — all covered by unit/integration/E2E tests in `pnpm test` and `pnpm release-gate:full`.

## Runtime

- [ ] Node 20 active locally
- [ ] Node 20 active in CI
- [ ] Clean install completed
- [ ] Storefront boots
- [ ] Admin boots
- [ ] Medusa boots with valid prod-safe env
- [ ] Express boots with INTERNAL_API_KEY
- [ ] Storefront fail-fast env assertions verified
- [ ] Medusa prod env validation verified

## Security

- [ ] pnpm audit triaged
- [ ] All critical runtime vulns fixed
- [ ] All high runtime vulns fixed or formally accepted
- [ ] Admin non-staff access denied
- [ ] Compliance route rejects missing/invalid key
- [ ] No secret leakage in browser or public env

## Data

- [ ] Checkout writes only through Medusa
- [ ] POS writes only through Medusa
- [ ] No hidden Express commerce routes
- [ ] No legacy commerce imports reachable from apps
- [ ] Active Supabase queries tested
- [ ] Schema matches current runtime code

## E2E

- [ ] Browse products
- [ ] PDP works
- [ ] Add to cart works
- [ ] Checkout handoff works
- [ ] Tracking path works
- [ ] Admin login works
- [ ] POS lookup works
- [ ] POS commit sale works
- [ ] Health endpoint works
- [ ] Compliance auth works

## Ship decision

- [ ] ALL GREEN = ship
- [ ] ANY RED = no ship
