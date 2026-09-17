# Operator notes: memory and production hardening

## Safe local development

Use the bounded launcher already configured by the repository:

```bash
pnpm cleanup:dev
pnpm dev
```

The web child receives `--max-old-space-size=1536`; the local Worker receives 768 MB. For attribution, run a bounded probe instead:

```bash
UVS_MEMORY_PROBE_DURATION_MS=900000 \
UVS_MEMORY_PROBE_INTERVAL_MS=5000 \
pnpm diagnose:dev-memory
```

The probe emits JSONL samples with the process tree, aggregate RSS, data-segment proxy, and HMR/full-reload/error counters. It forwards child output and stops the process group at the duration limit. It is a local development tool only; it is not imported by Next, the Worker, or Vercel functions.

The final 60-second smoke probe on this checkout reached a peak aggregate process-tree RSS of 1489.9 MiB while Next RSS settled near 350 MiB and produced no OOM, error, or full-reload counter. This is a startup stability signal, not a substitute for the longer repeated-CMS-edit reproduction.

Stop the run immediately if aggregate RSS approaches available host memory, swap begins growing rapidly, or the kernel reports an OOM precursor. Do not collect heap snapshots during host pressure. After a crash, preserve:

```bash
journalctl -k -b --no-pager | rg -i 'oom|out of memory|killed process|next-server'
```

For the CMS reproduction, record one baseline sample, edit the same draft repeatedly for up to 15 minutes, then compare the web/Worker process rows with browser renderer memory. Do not run build, typecheck, E2E, and dev watch processes concurrently.

## Verification order

```bash
pnpm --filter @universal-music-store/web exec tsx --test \
  src/lib/auth-cache.test.ts \
  src/lib/admin-sse-hub.test.ts \
  src/lib/admin-rate-limit.test.ts \
  src/app/api/admin/inventory/stream/route.test.ts \
  src/components/cms/cms-page-builder-preview.test.ts

pnpm --filter @universal-music-store/web exec eslint src/lib/auth.ts \
  src/lib/admin-sse-hub.ts src/app/api/admin/sse/route.ts \
  src/app/api/admin/inventory/stream/route.ts src/lib/admin-rate-limit.ts \
  src/components/cms/CmsPageBuilder.tsx

NODE_OPTIONS=--max-old-space-size=1536 \
  pnpm --filter @universal-music-store/web exec tsc --noEmit --pretty false -p tsconfig.json
```

Run the Worker test/typecheck and full release gates sequentially after the current dirty migration has a tracked source of truth. Provider-backed checks must use documented credentials and must not be simulated with empty secrets.

## Deployment/source-of-truth rule

The live Vercel project is `universalmusic` and currently reports historical root `apps/storefront`; the current local migration uses `apps/web`. Do not change Vercel Root Directory, deploy, or promote `dev` until the deployed commit and local migration relationship are confirmed through normal branch/PR workflow.

Production health checks currently used:

```bash
curl -fsSIL https://universalmusic.vercel.app/
curl -fsS https://universalmusic.vercel.app/api/health
```

## SQL and data safety

There are exactly two database ownership boundaries: `MEDUSA_DB_URL` for commerce and `APP_DB_URL` for platform/CMS/RBAC/audit data. Run `EXPLAIN (ANALYZE, BUFFERS)` only against a safe representative environment. Do not add an index or rewrite a transaction based on static grep alone, and do not run mutating diagnostics against production.

## Rollback

All changes in this pass are local working-tree changes. Revert only the specific hardening files through the normal review workflow after identifying the regression; do not use `git reset --hard`, broad checkout, or recursive deletion because this workspace contains unrelated migration work. If the dev probe itself causes overhead, stop the wrapper; it has no application-side state.

## Known release blockers

- Current migration tree is heavily dirty/untracked with deleted legacy app trees.
- Vercel source mapping is unresolved despite the live deployment being healthy.
- Production traffic metrics and safe SQL EXPLAIN evidence are not available in this checkout.
- Full provider-backed commerce/security/E2E verification remains environment-dependent.
