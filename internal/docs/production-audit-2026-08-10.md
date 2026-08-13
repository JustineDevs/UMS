# Executive production audit

This is the engineer, QA, and adversarial review for the 2026-08-10
production-readiness pass. The repository contains a large pre-existing dirty
worktree, so this audit evaluates current behavior and the changes made in this
pass without reverting unrelated work.

Initial inventory identified 113 admin API route files, 75 mutating or
JSON-bearing route matches, and only three explicit schema-parser markers.
The canonical admin guard and OpenAPI checks now pass for the complete route
inventory, but the inventory numbers are retained because the static checks do
not prove every business invariant or external integration behavior.

# Newly discovered issues

1. The J&T CSV export accepted an authenticated session without an export
   permission, parsed raw JSON, executed unbounded upstream work, and exposed
   upstream failure detail.
2. Audit-log access bypassed the canonical staff guard and returned raw
   database error messages.
3. The checked-in OpenAPI generator could emit duplicate path keys, making the
   reference contract structurally ambiguous.
4. Storefront auth aliases referenced stale absolute pnpm-store paths after the
   dependency refresh, breaking the production webpack build.
5. React Doctor found an accessibility error, an unsafe dynamic evaluation,
   and render-time mutable ref writes.
6. Production dependency audit still reports three moderate transitive
   advisories and the resolver still reports a React 18 / React Router 8 peer
   mismatch.

# Fixed in this pass

- Added permission-aware canonical staff guards to audit logs and J&T export.
- Added strict Zod parsing, duplicate-ID rejection, bounded export concurrency,
  correlation IDs, generic errors, and aggregate failure metadata.
- Added OpenAPI route/operation consistency validation for 158 operations.
- Fixed the lookup handler's side-effect pattern and ProductEditorForm render
  purity issues.
- Fixed storefront option semantics and removed the dynamic `eval` path from
  bot verification.
- Removed stale auth shims and aliases; admin and storefront production builds
  now complete.
- Added pinned Knip and React Doctor commands, contract checks, and fail-closed
  SBOM audit/license behavior.

# Duplicates consolidated

- Stale generated storefront auth shim files were removed after replacing the
  old absolute-path aliases with normal pnpm package resolution.
- Audit and export authorization now share the existing staff-session guard
  instead of maintaining separate authentication paths.
- OpenAPI generation now consolidates operations under one canonical path key.

# Logic corrected

- Export access requires `analytics:export`.
- Audit-log CSV access requires `analytics:export`; normal access requires
  `dashboard:read`.
- Validation rejects unknown body keys, empty IDs, excessive batches, and
  duplicate IDs before upstream work.
- Upstream export failures no longer disclose provider response text or order
  identifiers.
- Correlation IDs are returned and used for generic operational errors.

# Test coverage added

The following checks passed in the final loop:

- `pnpm install --frozen-lockfile` was previously passed; the final rerun was
  blocked by a root-owned `apps/admin/node_modules/@sentry/nextjs` symlink
  during pnpm linking, not by lockfile drift.
- `pnpm run security:check`
- `pnpm run quality:contracts`
- `pnpm run quality:react-doctor` with 0 errors
- Admin TypeScript check
- Touched admin and storefront ESLint checks
- Standalone storefront production build with 89 generated routes
- Full `pnpm run release-gate`
- Full listed unit/integration/Medusa test suites
- `pnpm audit --prod --audit-level high` with zero high and critical findings
- Full-workspace `pnpm audit --json` with zero high and critical findings

The release gate passed lint, builds, security checks, contract checks, and
test suites. It intentionally skips hosted/browser business-proof suites
unless `pnpm run release-gate:full` is used.

# Breaking change review

- J&T export now requires an explicit export permission and rejects malformed
  or oversized requests. This is an intentional security contract change.
- Audit-log error responses are now generic. Operators must use the returned
  request ID to correlate server logs.
- Dependency and lockfile changes were applied through pnpm remediation; the
  remaining peer mismatch is not suppressed.

# Remaining risks

- `pnpm audit --prod --audit-level high` is green with zero high and critical
  findings and three moderate findings remaining for dependency-owner review.
  The full workspace audit is also at zero high and critical, with four
  moderate and one low finding remaining.
  The previous high findings were transitive `path-to-regexp` and
  `brace-expansion` resolutions; compatible package-specific resolutions now
  preserve Express 4's parser contract and use patched dependency lines.
- The workspace resolves `react-router` 8.x against React 18. This requires an
  owning-dependency upgrade or a compatible resolution, not suppression.
- React Doctor reports 662 warnings. Knip reports 533 unused-file candidates,
  5 unused dependencies, 57 unused exports, 16 unused exported types, and 3
  duplicate exports. These require ownership review because the repository
  includes legacy/reference applications.
- The storefront build emits a non-fatal static-analysis warning around the
  server-only `createRequire` call used to remove `eval`; the blocking React
  Doctor error is resolved, but this warning should be revisited with the
  bot-verification package owner.
- Hosted browser flows, payment-provider credentials, webhook delivery, and
  production database migration approval were not proven by the local gate.
- A clean frozen install must be rerun after correcting the root-owned local
  node_modules symlink; no sudo-capable workspace operation was available in
  this session.

# Final ship verdict

**Not ready for unqualified production shipment.**

The static and logic release gate is green, and the newly fixed route/build
regressions are covered by targeted checks. Production shipment remains
conditional on the unresolved React peer mismatch, moderate advisory review,
and missing hosted browser/external-integration proof. The repository now
fails closed and reports those conditions instead of presenting a misleading
clean result.
