# Production Operator Notes

## Required checks

Run these from the workspace root on Node 20:

```bash
pnpm install --frozen-lockfile
pnpm run quality:contracts
pnpm run quality:react-doctor
pnpm run quality:knip
pnpm audit --prod --audit-level high
pnpm run release-gate
```

`quality:knip` is intentionally advisory because the repository contains
legacy/reference applications and generated editor assets. Its output must be
reviewed before deleting anything. React Doctor blocks new error-severity
findings for the admin and storefront packages.

## Evidence captured in this pass

- Admin API route guard check: passed.
- Checked-in admin OpenAPI consistency: passed for 158 operations.
- Admin package TypeScript check: passed.
- Touched admin route/component ESLint check: passed.
- React Doctor admin and storefront scan: 0 errors, 662 warnings.
- Knip advisory scan: 533 unused-file candidates, 5 unused dependencies,
  57 unused exports, 16 unused exported types, and 3 duplicate exports.
- Production audit: 0 critical, 0 high, 3 moderate, 0 low after compatible
  dependency remediation.
- Full-workspace audit: 0 critical, 0 high, 4 moderate, 1 low.
- Final frozen-install rerun was blocked while pnpm attempted to replace a
  root-owned `apps/admin/node_modules/@sentry/nextjs` symlink. The lockfile
  was already confirmed current and the release gate passed using the existing
  dependency graph; clean-install proof must be rerun after ownership cleanup.

## Do not ship while

- The production audit reports a high or critical vulnerability.
- The workspace has an unresolved React peer mismatch.
- Remaining moderate advisories have not been reviewed and accepted by the
  owning dependency teams.
- Full build, unit, integration, and critical browser checks have not run in
  the target deployment environment.
- Required external credentials, webhook secrets, payment sandbox access, or
  database migration approval are missing.
