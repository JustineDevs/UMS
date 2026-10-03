# Release Gate — Spec Compliance Report

**Date:** 2026-03-22

## Evidence Alignment (Proof Consistency)

| Command | Proves |
|---------|--------|
| `pnpm release-gate` | Lint, security check, audit triage, unit/integration/database/Medusa tests. Node 20 enforced. Does **not** prove boot or E2E. |
| `pnpm release-gate:full` | Above + **boot** (Playwright webServer starts storefront, admin, Medusa, Express) + **E2E** (browse, PDP, cart, checkout, admin, health, compliance). Automated proof of Runtime and E2E board items. |

All five previously manual items are now automated:
- **Storefront fail-fast env:** `packages/sdk/src/env/medusa-storefront.test.ts` — asserts `assertMedusaStorefrontEnvProduction` throws in production when keys/URL invalid.
- **Medusa prod env validation:** `apps/medusa/src/loaders/validate-process-env.stress.test.ts` — covered by Medusa stress tests.
- **Express INTERNAL_API_KEY boot failure:** `apps/api/src/lib/checkProductionInternalApiKey.test.ts` — asserts `shouldFailBootForMissingInternalKey()` returns true when production and no key.
- **Admin non-staff denial:** `packages/platform-data/src/admin-users.test.ts` — asserts `checkStaffRole` returns NOT_STAFF for customer/member.
- **Compliance key rejection:** `apps/api/src/lib/requireInternalApiKey.test.ts` + `stress-test/e2e/smoke/api.spec.ts` — unit test for 401 without key; E2E for GET /compliance/export 401.

---

## Committed (All Implemented)

### 1. Release board artifact
- **Deliverable:** `internal/docs/release-board.md` — Same-Day Release Board with Runtime, Security, Data, E2E columns and ship decision rule.
- **Owner:** Platform
- **Proof:** File exists; checkboxes for manual verification; rule: ALL GREEN = ship, ANY RED = no ship; documents `release-gate` vs `release-gate:full`.

### 2. Audit triage
- **Deliverable:** `internal/docs/audit-triage.md` — All 33 vulns classified by severity, source, exposure, reachability, decision.
- **Owner:** Security
- **Proof:** 17 high (Vercel transitive) marked ACCEPT with rationale; 0 critical.

### 3. Database-layer tests
- **Deliverable:** `packages/database/src/compliance.test.ts` — Tests for `exportDataSubjectByEmail`, `anonymizeStaleOrderAddresses`.
- **Owner:** Backend
- **Files:** `packages/database/src/compliance.test.ts`
- **Functions:** `exportDataSubjectByEmail`, `anonymizeStaleOrderAddresses` (platform-data)
- **Behavior:** Mock Supabase; user-not-found returns null; user-found returns bundle; retention no-op returns 0.
- **Validation:** 3/3 tests pass.

### 4. Release gate script
- **Deliverable:** `scripts/release-gate.js` — Runs lint, security check, audit triage, full test suite. Enforces Node 20. Optional `--include-e2e` runs Playwright (which starts all 4 apps via webServer) and E2E.
- **Owner:** Platform
- **Proof:** `pnpm release-gate` exits 0 when all pass; fails immediately if Node ≠ 20.

### 5. Audit triage check script
- **Deliverable:** `scripts/check-audit-triage.js` — Validates 0 critical, high triaged in audit-triage.md.
- **Owner:** Platform
- **Proof:** Exit 0 when triage doc exists and covers high findings.

### 6. CI release gate
- **Deliverable:** `.github/workflows/release-gate.yml` — Runs on push/PR to main, develop; Node 20; `pnpm release-gate`.
- **Owner:** Platform
- **Proof:** Workflow file exists; runs on main/develop PRs.

### 7. Security audit workflow update
- **Deliverable:** `.github/workflows/security-audit.yml` — Audit step uses `check-audit-triage.js` instead of `pnpm audit --audit-level=high`.
- **Owner:** Platform
- **Proof:** Workflow updated.

### 8. E2E and boot proof
- **Deliverable:** `pnpm release-gate:full` — Playwright config starts storefront (3000), admin (3001), Medusa (9000), Express (4000); E2E runs against running stack.
- **Owner:** Platform
- **Proof:** `playwright.config.ts` webServer starts all four apps; `release-gate:full` invokes E2E.

---

## Blocked

None.

---

## Production readiness

`pnpm release-gate` proves: lint, security, audit triage, unit/integration/database/Medusa tests. It does **not** prove boot or E2E.

`pnpm release-gate:full` proves: above + all four apps boot + E2E (browse, PDP, cart, checkout, admin, health, compliance). The five negative-path checks (storefront fail-fast env, Medusa prod env, Express INTERNAL_API_KEY boot, admin non-staff denial, compliance key rejection) are covered by targeted unit/integration/E2E tests run by `pnpm test` and `pnpm release-gate:full`. No manual verification remains for those items.

**Ship rule:** Ship only after Node 20 runs `pnpm release-gate` and `pnpm release-gate:full` successfully. Until both pass, status is **no ship**.

**Path to ship proof when full gate fails on Windows:** Push to `main` or a version tag (`v*`) triggers `.github/workflows/release-gate-full.yml` on ubuntu-latest (Node 20), or use Actions → release-gate-full → Run workflow. CI avoids the Medusa ESM boot issue. Alternatively: start all four apps manually, then `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e`.

## Platform notes

- **Windows:** Test scripts use explicit file paths (not globs) because Node's `--test` glob patterns fail on Windows with pnpm. New test files must be added to each package's `test` script in `package.json`.
- **Node version:** Use Node 20 (`fnm use 20` or `nvm use 20`). The gate exits 1 if Node ≠ 20.
- **release-gate:full on Windows:** Medusa may fail to boot with `ERR_REQUIRE_ESM` when loading `medusa-config.ts` (ESM/require conflict). If so, run full E2E in CI (Linux) or start all four apps manually, then `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e`.

---

## Final Verdict (Spec)

| Item | Status |
|------|--------|
| Release board | IMPLEMENTED |
| Audit triage | IMPLEMENTED |
| Database tests | IMPLEMENTED |
| Release gate script | IMPLEMENTED |
| Audit triage check | IMPLEMENTED |
| CI release gate | IMPLEMENTED |
| Security audit update | IMPLEMENTED |
| E2E + boot (release-gate:full) | IMPLEMENTED |

**Checklist Items:** Implemented 8, Blocked 0, Not Done 0.

**Spec Drift:** No.
