# Production-readiness audit — 2026-09-29

## Executive production audit

**Verdict: Not ready for unrestricted production onboarding.**

### Current evidence refresh — 2026-09-29

The following supersedes earlier intermediate observations in this document:

- Cloudflare Worker production was redeployed as version `8f8f346a-1f10-4d20-b0d4-3c986751d732`; direct `/readyz` returned HTTP 200 with both APP and Medusa database roles ready.
- Vercel deployment `dpl_5LVno3rqv48wDBzDjegU2jWCgHZr` is live; `pnpm check:deployed-health-contract` passed against the public storefront. The older `worker.healthReachable` observation is historical, not current evidence.
- The authenticated production runtime-settings control plane showed `enabledPaymentProviders: ["COD"]`. Through that control plane, only `XENDIT` was added while preserving the existing payload. Worker and Vercel now expose `XENDIT` and `COD`.
- Deployed Xendit checkout reached the hosted-payment flow successfully in 1.1 minutes; failed and expired return tests also passed (2/2). This proves checkout/return behavior, not webhook delivery, refund/reconciliation, or chargeback operations.
- The production-mode CMS mutation/restore soak passed 15/15 in 5.0 minutes. This is not a telemetry-backed 15-minute memory-leak certification.
- Fresh deployed checks passed PayPal cancel/decline (2/2), Xendit hosted handoff (1/1), Xendit failure/expiry returns (2/2), performance (6/6), About/catalog (3/3), API security (9/9), and public route checks. Fresh isolated production-artifact Stripe success/decline and COD confirmation flows reached scoped order tracking; the invalid COD body returned HTTP 400. Stripe production webhook proof remains blocked because Stripe is disabled for the current merchant context.
- Fresh deployed axe found a serious `aria-tooltip-name` violation in the catalog Types tooltip. The source fix is implemented and the rebuilt local storefront axe suite passes 10/10, but deployment and a hosted rerun remain required.
- Read-only `EXPLAIN (ANALYZE, BUFFERS)` probes completed against both configured databases; intended indexes were used where data volume justified them. Production traffic/cardinality and p95 evidence remain open.

This is a substantial commerce platform, not a thin UI wrapper. The repository contains a real Next.js storefront/admin application, a Cloudflare Worker backend, two explicitly separated PostgreSQL ownership domains, durable queue processing, payment-provider adapters, signed webhook handling, idempotency, RBAC, RLS, request limits, and CI security gates.

It is also not honestly verifiable as production-hardened from this checkout. The strongest local gates pass, but several release-critical claims remain unproven outside the repository:

| Area | Evidence found | Production conclusion |
|---|---|---|
| Type safety | Root `pnpm typecheck` passed | Strong local signal |
| Lint | Root `pnpm lint` passed | Strong local signal |
| Contract boundaries | `pnpm quality:contracts` passed | Strong local signal |
| Database schema | 134 migrations applied, 0 pending; database tests 6/6 passed | Local database is coherent |
| Secret-file hygiene | `pnpm security:check` passed; 0 sensitive files found | Local repository scan passed; this is not a remote vulnerability scan |
| Dependency/static security | Local low-severity audit, Semgrep, current-source Gitleaks, and lockfile Trivy scans are clean; GitHub `security-audit` run `36276386392` passed on baseline `c71c99b6` | Current dirty-worktree changes still need a new hosted run; the baseline result is not evidence for uncommitted edits |
| Unused-code hygiene | Knip now completes with no findings after removing the unused starter surface and dead exports | Local unused-code gate is clean |
| Runtime health | Worker `/readyz` probes both databases | Useful readiness probe exists |
| Runtime health | Next `/api/health` and Worker `/health`/`/healthz` are explicitly liveness-only; Worker `/readyz` and Next `/api/health/sop` are dependency-aware | Endpoint semantics are separated and regression-tested |
| Current public runtime probe | Production Worker `/readyz` and public Vercel health contract passed after Worker deployment `8f8f346a-1f10-4d20-b0d4-3c986751d732` | Current endpoint contract is verified; commit/source reconciliation and long-term monitoring remain open |
| Provider correctness | Deployed Xendit hosted checkout passed; Xendit failed/expired returns passed 2/2; live methods expose XENDIT and COD | Webhook delivery, refund/void, reconciliation, and chargeback proof remain external |
| Deployment provenance | Vercel/Cloudflare configuration exists | Current dirty checkout is not proven to equal deployed commits |
| Capacity/performance | Bounded reads, retry limits, and queue backoff exist | No current production p95, cache-hit, cost, or `EXPLAIN` evidence |

### Hard-nosed score

- **Architecture quality:** 7/10. The boundaries are deliberate and materially better than a typical prototype.
- **Security posture in source:** 7/10. The controls are real, but health semantics and deployment evidence weaken confidence.
- **Operational proof:** 4/10. The important provider, deployment, load, and database-plan evidence is incomplete.
- **Overall production readiness:** 5/10. Suitable for controlled internal/staging validation; not yet suitable for a broad paid-order launch.

## Newly discovered issues

### Resolved locally — health check semantics

The health contract was hardened during this audit. The storefront SOP health
route now probes Worker readiness, returns a degraded status when the Worker is
not ready, and reports the deployment commit SHA. The local route test and
`pnpm check:deployed-health-contract` enforce that shape. The current public
deployment passed this contract; older failures below are retained as historical
evidence only.

1. `apps/web/src/app/api/health/route.ts` returns `200 {status:"ok"}` unconditionally. It does not test Worker reachability, either database, migrations, queue bindings, authentication, or payment dependencies.
2. `apps/web/src/app/api/health/sop/route.ts` now probes `/readyz` and returns HTTP 503 when the Worker is degraded. This closes the false-green monitor path.
3. `workers/backend/src/router.ts` explicitly treats `/health` and `/healthz` as liveness and `/readyz` as dependency-aware readiness.

**Required correction:** define a clear contract: liveness must only prove the process is alive; readiness must fail closed when required dependencies are unavailable; the storefront health route must not be used as a production dependency check unless it actually checks the dependency graph. Add tests asserting degraded HTTP semantics and document which endpoint each platform monitor uses.

### P1 — production deployment posture is ambiguous

`wrangler.jsonc` sets `workers_dev: true` for the production environment. That may be intentional during transition, but it is not a clean production posture unless the public `workers.dev` endpoint is explicitly part of the threat model and traffic policy. Confirm the canonical custom route, disable the public development endpoint where possible, and prove that Vercel calls only the intended Worker origin.

The current checkout is also heavily dirty. The deployment is live and healthy, but a dirty working tree still prevents claiming that every local uncommitted change is present in production.

Historical probes found the public Vercel response behind the readiness contract. After the reviewed Worker deployment and public contract check, the current response is certified for the checked endpoint. A clean commit-to-artifact attestation is still required before treating the whole dirty checkout as deployed.

### P1 — payment and order truth is not fully provider-verified

The source contains Stripe, PayPal, Xendit, and COD flows, signed webhook paths, idempotency, retry, reconciliation, and tests. The deployed Xendit hosted checkout now passes, and failed/expired returns do not expose an order. Webhook delivery, refund/void, reconciliation, chargebacks, and retained provider artifacts still require external evidence before payment state can be called fully production-proven.

### P1 — database and capacity proof is incomplete

The schema boundary and migration registry are healthy locally. There is no current representative production `EXPLAIN (ANALYZE, BUFFERS)`, connection-pool/Hyperdrive saturation evidence, queue lag/DLQ dashboard, or route-level p95/cost budget. Do not add indexes or claim scalability from static SQL inspection alone.

### P2 — cleanup and dependency drift were found and corrected locally

The initial audit found a stale Storybook starter surface, invalid Storybook references, and an unused `AuditTimeline` export. Those findings were removed or corrected; the current `pnpm quality:knip` run completes with no findings. This is now a clean local gate, but it still needs to be included in the reviewed deployment commit.

### P2 — operational observability is not yet an SLO system

Cloudflare invocation logs, request IDs, PostHog, Vercel Analytics, and route metrics exist. The audit did not find current evidence of enforced SLOs, alert thresholds, queue-lag alerts, DLQ ownership, payment-reconciliation alerts, or an on-call runbook tied to those signals. Logs are not the same as operational detection.

## Fixed in this pass

The implementation pass made the following changes and verified them locally:

- Database cleanup migration `packages/database/supabase/migrations/128_schema_cleanup.sql` exists and was applied successfully.
- Migration status is **134 applied / 0 pending**.
- Database regression tests are **6/6 passing**.
- Root typecheck and lint passed.
- Contract gates passed, including admin guards, OpenAPI parity/source drift, route ownership, route-state coverage, storefront client boundary, migration boundary, responsive contract, webhook boundary, and audit triage.
- The local sensitive-file check passed with zero findings.
- The storefront SOP health route now targets Worker `/readyz`, returns 503 for degraded readiness, and has 2 regression tests.
- Worker deployment preflight now requires environment-specific `PUBLIC_WORKER_URL` values and rejects preview/stable URL cross-wiring.
- Knip completes without findings.
- The generated admin OpenAPI source and PDF were refreshed and source-drift checks pass.
- The responsive contract and audit-triage gates pass.
- The release gate passes with lint, Knip, architecture contracts, Worker configuration preflight, build, security, and 585 repository tests.
- Direct runtime probes reached both configured Worker origins and verified HTTP 200 readiness with APP and Medusa database roles; the current deployed-health-contract check passed after Worker deployment `8f8f346a-1f10-4d20-b0d4-3c986751d732`.
- The isolated local provider matrix completed with **13 passed / 5 explicitly skipped / 0 failed**. The deployed Xendit hosted checkout passed in 1.1 minutes, with failed and expired return paths passing 2/2 after enabling XENDIT through the audited runtime-settings API.
- A scheduled GitHub Actions `deployed-health-contract` workflow now repeats that public contract check every 15 minutes and fails closed on readiness loss or deployment schema drift.

These are verified repository checks, not a claim that the public deployment is equivalent or that provider-backed payments have been exercised.

## Fresh local security evidence — 2026-09-29

The repository-local security pass completed after the dependency, crypto, and preview-bridge fixes:

- `pnpm audit --audit-level low`: no known vulnerabilities. The vulnerable transitive `undici` path was pinned to `7.29.1`, and the Storybook Webpack adapter was replaced with the Vite adapter.
- Semgrep (`p/typescript`, `p/nodejs`, `p/owasp-top-ten`, and `p/react`): **0 blocking findings** across 1,613 tracked files and 83 rules. The GCM token decoder now enforces a 16-byte authentication tag; the CMS/JSON-LD HTML findings were reviewed and annotated at the safe, sanitized boundaries.
- Gitleaks source-directory scans for `apps/web/src`, `workers/backend/src`, `packages`, and `scripts`: clean. A full immutable Git-history scan still reports 24 historical fixture/document/example fingerprints; no history rewrite was performed, and those findings are not current source credentials.
- Trivy lockfile vulnerability scan: no vulnerabilities in `pnpm-lock.yaml`. A filesystem scan also sees six medium JWT-shaped values in ignored local `.env*` files; these files are not tracked and are outside a clean CI checkout. They remain a local secret-management/rotation concern, not a checked-in source finding.
- OpenSSF Scorecard on the tracked snapshot: **8.2/10**. The remaining score deductions are maturity heuristics (fuzzing, packaging metadata, license classification, and local-history SAST detection), not an identified exploitable defect. The current dependency audit is cleaner than the historical snapshot used by Scorecard.
- Current checkout recheck (2026-10-02): the unauthenticated local Scorecard run completed at **7.0/10** with zero detected dependency vulnerabilities and no dangerous workflow patterns. The lower local score is affected by ignored `node_modules` binaries and local-history limitations; it is not a remote repository result. A token-authenticated remote scan remains the authoritative Scorecard evidence.
- Storybook now builds with `@storybook/nextjs-vite`; the production Storybook build completed successfully.
- Final local rerun also passed the production build, `pnpm audit --audit-level low`, Worker migration-status check, source-scoped Gitleaks scan, and `git diff --check`. Trivy is not installed in this environment, so its earlier lockfile result remains historical evidence and is not presented as a fresh local rerun.

GitHub Actions history confirms the `security-audit` workflow passed on commit `c71c99b6` in run `36276386392` on 2026-09-26. That proves the checked-in baseline was scanned successfully, but the current hardening edits are still uncommitted in this worktree, so a fresh CI run for this exact diff is still required before claiming remote-scan closure.

## Blocked outside repo

The following cannot be honestly certified from source alone:

1. Clean commit/root/Worker/API attestation for every local change; the current deployment is healthy, but this checkout remains dirty.
2. Production secrets, Cloudflare bindings, Vercel environment parity, and rotation history.
3. Retained artifacts for authenticated provider journeys, including the now-passing Xendit hosted-success over HTTPS.
4. Stripe, PayPal, Xendit, J&T, Resend, Nango, and POS external callback delivery, retry, refund/reconciliation, and chargeback behavior.
5. Representative production query plans, traffic cardinality, p95 latency, queue lag, and cost.
6. Controlled CMS editor memory soak and host-level OOM behavior.
7. A fresh remote Gitleaks/Trivy/Semgrep/dependency-scan result for the current hardening diff; the last successful `security-audit` run is for baseline `c71c99b6`.

## Duplicates consolidated

The intended ownership model is coherent and should remain the governing rule:

- **Medusa database:** catalog, prices, carts, checkout, orders, payment state, fulfillment, inventory, stock locations, regions, tax configuration, and commerce customer records.
- **Application/Supabase database:** staff identity/RBAC, CMS, audit, POS operations, workflow metadata, integrations, compliance, and derived analytics.
- **Worker bridge:** one request coordinates cross-database work, with explicit idempotency, ordering, retry, and audit behavior.

The schema cleanup and migration tests support this direction. The remaining risk is governance drift: any new legacy table that stores live product, order-line, inventory, or checkout-total authority would recreate the duplication this model is designed to prevent.

## Logic corrected

The codebase already contains meaningful corrective logic:

- role-specific APP/MEDUSA database access through Hyperdrive bindings;
- signed/internal webhook verification and replay protection;
- idempotency for mutation and retry paths;
- bounded public/admin reads and queue payloads;
- bounded retries with dead-letter queues;
- staff authorization and permission checks;
- RLS/migration boundary checks;
- safe provider error normalization;
- CMS preview sanitization and safe URL handling;
- explicit route ownership and source-drift checks.

The local logic correction is complete and tested. The remaining operational risk is deployment drift: the public Vercel deployment has not yet picked up the current `readyReachable` response contract.

## Test coverage added

Evidence reviewed includes database migration/compliance tests, Worker regression tests, web typecheck/lint, contract gates, and security checks. The next required tests are:

1. Deployment smoke tests against the exact deployed commit and configured Worker origin.
2. Authenticated provider sandbox tests for every enabled payment provider, including Xendit hosted-success and webhook/reconciliation/refund evidence.
3. Queue retry/DLQ and payment reconciliation alert tests.
4. A fresh deployed-health-contract run after the reviewed commit is deployed; the local Knip graph and local provider matrix are already clean.

## Breaking change review

The SOP endpoint now returns 503 when dependency-aware readiness is degraded. Any monitor that expected HTTP 200 from a degraded response must be updated to use the documented `/readyz` and `/api/health/sop` contract. The named production `workers.dev` origin remains the documented canonical backend URL; no custom-domain cutover was assumed.

## Remaining risks

- A passing local gate does not prove deployment provenance.
- A mocked provider test does not prove webhook delivery, credentials, clock skew, provider retries, or refund correctness.
- A `SELECT 1` readiness probe does not prove schema compatibility or commerce correctness.
- The app has a broad and actively changing dirty worktree; release artifacts must come from a clean, reviewed commit.
- Existing architecture and hardening documents contain historical snapshots. They must not be read as current evidence unless their date and command output are explicit.
- External provider, deployment, capacity, and live alert evidence remains outside this checkout and cannot be inferred from local tests.
- The retained matrix verifier reports 403 resolved rows (63 verified, 340 explicitly blocked) with zero unresolved evidence errors. Current blocked rows include deployed Stripe webhook confirmation and the deployed axe regression, each with a recovery condition.

## Final ship verdict

**Not ready for unrestricted production onboarding.**

The platform is credible engineering work with real production-shaped controls. It is not yet real-verified production grade because the evidence chain stops at local source and contract verification before deployment provenance, provider-backed payment journeys, production database plans, and operational alerting are proven. Health semantics, deployment URL cross-wiring, and local Knip drift are now corrected; the remaining verdict depends on external evidence and a clean reviewed deployment commit.
